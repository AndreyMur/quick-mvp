import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PaymentProvider } from "@/lib/payments/types";
import {
  resolveSubscriptionTransition,
  type SubscriptionTransition,
} from "@/lib/payments/subscription-events";

/**
 * Обработка webhook подписки (фаза 22, #66).
 *
 * Гарантии:
 *  - подпись проверяется провайдером до любых записей в БД;
 *  - событие регистрируется в `payment_events` (уникальность provider+event_id),
 *    поэтому повторная доставка не применяет переход дважды;
 *  - при ошибке применения «заявка» удаляется, чтобы провайдер мог повторить.
 */

type Client = SupabaseClient<Database>;

export interface WebhookResult {
  status: "processed" | "duplicate" | "ignored";
  eventId: string;
  eventType: string;
  transition: SubscriptionTransition | null;
}

export interface HandleWebhookParams {
  provider: PaymentProvider;
  supabase: Client;
  payload: string;
  signature: string | null;
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|already exists/i.test(error.message ?? "");
}

/** Ищет пользователя по идентификатору подписки провайдера (для invoice-событий). */
async function findUserIdByProviderSubscription(
  supabase: Client,
  provider: string,
  providerSubscriptionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();

  return (data as { user_id?: string } | null)?.user_id ?? null;
}

async function applyTransition(
  supabase: Client,
  transition: SubscriptionTransition
): Promise<void> {
  if (!transition.userId) {
    throw new Error("Не удалось определить пользователя для подписки");
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: transition.userId,
        plan: transition.plan,
        status: transition.status,
        provider: transition.provider,
        provider_subscription_id: transition.providerSubscriptionId,
        provider_customer_id: transition.providerCustomerId,
        current_period_start: transition.currentPeriodStart,
        current_period_end: transition.currentPeriodEnd,
        cancel_at_period_end: transition.cancelAtPeriodEnd,
      } as never,
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`Не удалось сохранить подписку: ${error.message}`);
  }

  // Держим профиль в согласии с подпиской: административная панель и
  // legacy-потребители читают `profiles.subscription_tier`.
  await supabase
    .from("profiles")
    .update({ subscription_tier: transition.plan } as never)
    .eq("id", transition.userId);
}

export async function handlePaymentWebhook({
  provider,
  supabase,
  payload,
  signature,
}: HandleWebhookParams): Promise<WebhookResult> {
  // Бросает InvalidSignatureError — до этого момента в БД ничего не пишем.
  const event = provider.constructWebhookEvent(payload, signature);

  const base = { eventId: event.id, eventType: event.type };

  const claim = await supabase
    .from("payment_events")
    .insert({ provider: provider.name, event_id: event.id, type: event.type } as never);

  if (claim.error) {
    if (isUniqueViolation(claim.error)) {
      return { ...base, status: "duplicate", transition: null };
    }
    throw new Error(`Не удалось зарегистрировать событие: ${claim.error.message}`);
  }

  try {
    let transition = resolveSubscriptionTransition(event, provider.name);

    if (!transition) {
      return { ...base, status: "ignored", transition: null };
    }

    // invoice-события не несут user_id — находим владельца по подписке.
    if (!transition.userId && transition.providerSubscriptionId) {
      transition = {
        ...transition,
        userId: await findUserIdByProviderSubscription(
          supabase,
          provider.name,
          transition.providerSubscriptionId
        ),
      };
    }

    if (!transition.userId) {
      return { ...base, status: "ignored", transition: null };
    }

    await applyTransition(supabase, transition);

    return { ...base, status: "processed", transition };
  } catch (error) {
    // Освобождаем заявку, чтобы провайдер мог повторить доставку.
    await supabase
      .from("payment_events")
      .delete()
      .eq("provider", provider.name)
      .eq("event_id", event.id);
    throw error;
  }
}
