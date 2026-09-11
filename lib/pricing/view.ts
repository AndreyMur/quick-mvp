import type { PlanId } from "@/lib/subscription/entitlements";

/**
 * Чистая логика отображения страницы тарифов (фаза 23, #68/#69/#70).
 *
 * Вынесена из компонента, чтобы состояния кнопок и результат checkout
 * проверялись юнит-тестами без DOM.
 */

export type PlanButtonAction = "checkout" | "login" | "none";

export interface PlanButtonState {
  /** Можно ли нажать кнопку. */
  disabled: boolean;
  /** Действие по клику: оплата, вход или ничего. */
  action: PlanButtonAction;
  /** Является ли тариф текущим активным. */
  isCurrent: boolean;
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

export interface PlanButtonStateInput {
  tier: PlanId;
  currentTier: PlanId;
  isAuthenticated: boolean;
}

/**
 * Определяет состояние кнопки тарифа:
 * - текущий тариф заблокирован (повторная оплата активного плана запрещена);
 * - понижение тарифа «на лету» не поддерживается;
 * - бесплатный тариф нельзя купить;
 * - для гостя клик ведёт на вход, для пользователя — в checkout провайдера.
 */
export function getPlanButtonState({
  tier,
  currentTier,
  isAuthenticated,
}: PlanButtonStateInput): PlanButtonState {
  if (tier === currentTier) {
    return { disabled: true, action: "none", isCurrent: true };
  }

  if (PLAN_RANK[tier] < PLAN_RANK[currentTier]) {
    return { disabled: true, action: "none", isCurrent: false };
  }

  if (tier === "free") {
    return { disabled: true, action: "none", isCurrent: false };
  }

  return {
    disabled: false,
    action: isAuthenticated ? "checkout" : "login",
    isCurrent: false,
  };
}

export type CheckoutOutcome = "success" | "cancelled" | "error";

/**
 * Разбирает `?checkout=` из success/cancel URL провайдера.
 * Неизвестные значения игнорируются, чтобы не показывать ложный статус.
 */
export function parseCheckoutOutcome(
  value: string | null | undefined
): CheckoutOutcome | null {
  return value === "success" || value === "cancelled" || value === "error"
    ? value
    : null;
}

export type SubscriptionStatusKey =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type SubscriptionStatusTone = "success" | "warning" | "muted";

export interface SubscriptionStatusView {
  key: SubscriptionStatusKey;
  tone: SubscriptionStatusTone;
}

/** Переводит серверный статус подписки в ключ перевода и цвет бейджа. */
export function getSubscriptionStatusView(
  status: string | null | undefined,
  cancelAtPeriodEnd = false
): SubscriptionStatusView {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "canceled" || normalized === "cancelled") {
    return { key: "canceled", tone: "warning" };
  }
  if (normalized === "past_due") {
    return { key: "past_due", tone: "warning" };
  }
  if (normalized === "trialing") {
    return { key: "trialing", tone: "success" };
  }
  if (normalized === "active") {
    return {
      key: "active",
      tone: cancelAtPeriodEnd ? "warning" : "success",
    };
  }
  return { key: "inactive", tone: "muted" };
}

/**
 * Преобразует ошибку checkout-запроса в ключ перевода для сообщения.
 * `null` — запрос прошёл успешно.
 */
export function getCheckoutErrorKey(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 409) return "alreadyActive";
  if (status === 503) return "notConfigured";
  return "error";
}
