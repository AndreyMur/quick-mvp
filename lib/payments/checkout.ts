import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getUserSubscription } from "@/lib/subscription/entitlements";
import type { PaidPlanId } from "@/lib/payments/plans";
import type { CheckoutSession, PaymentProvider } from "@/lib/payments/types";

/**
 * Создание платёжной сессии checkout (фаза 22, #65).
 *
 * Серверная защита от повторной оплаты уже активного тарифа: клиент может
 * подделать состояние кнопки, поэтому проверяем эффективный тариф на сервере.
 */

type Client = SupabaseClient<Database>;

export class PlanAlreadyActiveError extends Error {
  constructor(plan: PaidPlanId) {
    super(`Тариф ${plan} уже активен`);
    this.name = "PlanAlreadyActiveError";
  }
}

export interface CreateCheckoutParams {
  supabase: Client;
  provider: PaymentProvider;
  user: { id: string; email?: string | null };
  plan: PaidPlanId;
  /** Origin запроса — база для success/cancel URL. */
  origin: string;
}

export async function createPlanCheckoutSession({
  supabase,
  provider,
  user,
  plan,
  origin,
}: CreateCheckoutParams): Promise<CheckoutSession> {
  const subscription = await getUserSubscription(supabase, user.id);

  if (subscription.entitlements.tier === plan) {
    throw new PlanAlreadyActiveError(plan);
  }

  const base = origin.replace(/\/$/, "");

  return provider.createCheckoutSession({
    userId: user.id,
    userEmail: user.email ?? null,
    plan,
    successUrl: `${base}/pricing?checkout=success&plan=${plan}`,
    cancelUrl: `${base}/pricing?checkout=cancelled&plan=${plan}`,
  });
}
