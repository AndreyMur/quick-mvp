import { isPlanId, type PlanId } from "@/lib/subscription/entitlements";
import type { WebhookEvent } from "@/lib/payments/types";

/**
 * Переходы состояния подписки по событиям провайдера (фаза 22, #67).
 *
 * Функция чистая: получает нормализованное событие и возвращает патч
 * подписки. Побочные эффекты (запись в БД, идемпотентность) — в `webhook.ts`.
 */

export interface SubscriptionTransition {
  userId: string | null;
  plan: PlanId;
  status: string;
  provider: string;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(
  source: Record<string, unknown> | null,
  key: string
): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Unix-секунды или ISO-строка → ISO-строка, иначе null. */
function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    const numeric = Number(value);
    const date = Number.isFinite(numeric)
      ? new Date(numeric * 1000)
      : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

/** Тариф из metadata объекта, metadata позиции или позиций подписки. */
function resolvePlanFromObject(object: Record<string, unknown>): PlanId {
  const metadata = asRecord(object.metadata);
  if (isPlanId(metadata?.plan)) return metadata.plan;

  const items = asRecord(object.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  for (const item of data) {
    const price = asRecord(asRecord(item)?.price);
    const priceMetadata = asRecord(price?.metadata);
    if (isPlanId(priceMetadata?.plan)) return priceMetadata.plan;
  }

  return "free";
}

function resolveUserId(object: Record<string, unknown>): string | null {
  const metadata = asRecord(object.metadata);
  return getString(metadata, "user_id") ?? getString(object, "client_reference_id");
}

export function resolveSubscriptionTransition(
  event: WebhookEvent,
  provider: string
): SubscriptionTransition | null {
  const object = event.data;

  switch (event.type) {
    // Оплата прошла — активируем выбранный тариф.
    case "checkout.session.completed": {
      const userId = resolveUserId(object);
      const plan = resolvePlanFromObject(object);
      if (!userId || plan === "free") return null;

      return {
        userId,
        plan,
        status: "active",
        provider,
        providerSubscriptionId: getString(object, "subscription"),
        providerCustomerId: getString(object, "customer"),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    // Синхронизация статуса и периода подписки.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      return {
        userId: resolveUserId(object),
        plan: resolvePlanFromObject(object),
        status: getString(object, "status") ?? "active",
        provider,
        providerSubscriptionId: getString(object, "id"),
        providerCustomerId: getString(object, "customer"),
        currentPeriodStart: toIsoTimestamp(object.current_period_start),
        currentPeriodEnd: toIsoTimestamp(object.current_period_end),
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
      };
    }

    // Подписка окончательно удалена — возврат на free.
    case "customer.subscription.deleted": {
      return {
        userId: resolveUserId(object),
        plan: "free",
        status: "canceled",
        provider,
        providerSubscriptionId: getString(object, "id"),
        providerCustomerId: getString(object, "customer"),
        currentPeriodStart: toIsoTimestamp(object.current_period_start),
        currentPeriodEnd: toIsoTimestamp(object.current_period_end),
        cancelAtPeriodEnd: false,
      };
    }

    // Оплата счёта продлевает период и снимает past_due.
    case "invoice.paid": {
      return {
        userId: resolveUserId(object),
        plan: resolvePlanFromObject(object),
        status: "active",
        provider,
        providerSubscriptionId: getString(object, "subscription"),
        providerCustomerId: getString(object, "customer"),
        currentPeriodStart: toIsoTimestamp(object.period_start),
        currentPeriodEnd: toIsoTimestamp(object.period_end),
        cancelAtPeriodEnd: false,
      };
    }

    // Сбой оплаты — доступ сохраняется до конца периода (grace period).
    case "invoice.payment_failed": {
      return {
        userId: resolveUserId(object),
        plan: resolvePlanFromObject(object),
        status: "past_due",
        provider,
        providerSubscriptionId: getString(object, "subscription"),
        providerCustomerId: getString(object, "customer"),
        currentPeriodStart: toIsoTimestamp(object.period_start),
        currentPeriodEnd: toIsoTimestamp(object.period_end),
        cancelAtPeriodEnd: false,
      };
    }

    default:
      return null;
  }
}
