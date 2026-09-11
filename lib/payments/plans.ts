import type { PlanId } from "@/lib/subscription/entitlements";

/**
 * Каталог платных тарифов (фаза 22, #65).
 *
 * Цены согласованы продуктово: Профессиональный — 99 у.е./мес,
 * Бизнес — 299 у.е./мес. Валюта задаётся переменной окружения
 * `PAYMENT_CURRENCY` (по умолчанию USD), потому что ТЗ оперирует
 * абстрактными «у.е.».
 */

export type PaidPlanId = Extract<PlanId, "pro" | "business">;

export interface PaidPlan {
  id: PaidPlanId;
  /** Название для провайдера и UI. */
  name: string;
  /** Цена в основных единицах валюты (99, а не 9900). */
  amount: number;
  interval: "month";
}

export const PAID_PLANS: Record<PaidPlanId, PaidPlan> = {
  pro: {
    id: "pro",
    name: "Профессиональный",
    amount: 99,
    interval: "month",
  },
  business: {
    id: "business",
    name: "Бизнес",
    amount: 299,
    interval: "month",
  },
};

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return value === "pro" || value === "business";
}

export function getPaymentCurrency(): string {
  return (process.env.PAYMENT_CURRENCY ?? "usd").trim().toLowerCase() || "usd";
}

/**
 * Валюты без дробной части: сумма передаётся провайдеру как есть.
 * Список соответствует zero-decimal currencies Stripe.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** Переводит цену в минимальные единицы валюты, которые ждёт провайдер. */
export function toMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}
