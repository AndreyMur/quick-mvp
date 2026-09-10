import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Единый серверный механизм определения активного тарифа и лимитов (фаза 21).
 *
 * Источник истины — запись подписки (`subscriptions`). Пока записи нет,
 * используется значение `profiles.subscription_tier` для обратной
 * совместимости. Лимиты выводятся из тарифа, а не из произвольных колонок.
 */

export type PlanId = "free" | "pro" | "business";

export interface PlanEntitlements {
  tier: PlanId;
  projectLimit: number;
  customServicesLimit: number;
  /** true — экспорт PDF содержит водяной знак. */
  watermark: boolean;
}

/**
 * Практический предел для тарифов «без ограничений». Продуктово лимита нет,
 * но числовое значение нужно для контракта API и UI.
 */
export const UNLIMITED_LIMIT = 1000;

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  free: {
    tier: "free",
    projectLimit: 3,
    customServicesLimit: 2,
    watermark: true,
  },
  pro: {
    tier: "pro",
    projectLimit: 20,
    customServicesLimit: UNLIMITED_LIMIT,
    watermark: false,
  },
  business: {
    tier: "business",
    projectLimit: UNLIMITED_LIMIT,
    customServicesLimit: UNLIMITED_LIMIT,
    watermark: false,
  },
};

const PLAN_IDS: readonly PlanId[] = ["free", "pro", "business"];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function normalizePlan(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

export interface SubscriptionSnapshot {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
}

/**
 * Статусы, при которых доступ сохраняется до окончания оплаченного периода.
 * `past_due` оставлен с доступом (grace period) до окончания периода.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isSubscriptionActive(
  snapshot: SubscriptionSnapshot,
  now: Date = new Date()
): boolean {
  const status = (snapshot.status ?? "").trim().toLowerCase();
  const periodEnd = snapshot.current_period_end
    ? new Date(snapshot.current_period_end)
    : null;
  const periodEndMs = periodEnd?.getTime() ?? NaN;
  const withinPeriod =
    periodEnd !== null && !Number.isNaN(periodEndMs) && periodEndMs > now.getTime();

  if (status === "canceled") {
    return withinPeriod;
  }

  if (!ACTIVE_STATUSES.has(status)) {
    return false;
  }

  return periodEnd === null || withinPeriod;
}

export function resolveEntitlements(
  snapshot: SubscriptionSnapshot,
  now: Date = new Date()
): PlanEntitlements {
  const plan = normalizePlan(snapshot.plan);

  if (plan === "free") {
    return PLAN_ENTITLEMENTS.free;
  }

  if (!isSubscriptionActive(snapshot, now)) {
    return PLAN_ENTITLEMENTS.free;
  }

  return PLAN_ENTITLEMENTS[plan];
}

export interface SubscriptionRecord {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  provider: string | null;
  provider_subscription_id: string | null;
}

export interface UserSubscription {
  plan: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  providerSubscriptionId: string | null;
  entitlements: PlanEntitlements;
  source: "subscription" | "profile";
}

type Client = SupabaseClient<Database>;

function asSubscriptionRecord(data: unknown): SubscriptionRecord | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return data as SubscriptionRecord;
}

/**
 * Возвращает активную подписку пользователя вместе с вычисленными лимитами.
 * Если записи подписки нет (или запрос не удался), тариф берётся из профиля.
 */
export async function getUserSubscription(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<UserSubscription> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, current_period_end, cancel_at_period_end, provider, provider_subscription_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const record = asSubscriptionRecord(data);

  if (record) {
    const entitlements = resolveEntitlements(record, now);
    return {
      plan: entitlements.tier,
      status: record.status ?? "active",
      currentPeriodEnd: record.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(record.cancel_at_period_end),
      provider: record.provider ?? null,
      providerSubscriptionId: record.provider_subscription_id ?? null,
      entitlements,
      source: "subscription",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  const plan = normalizePlan(
    (profile as { subscription_tier?: string | null } | null)?.subscription_tier
  );
  const entitlements = resolveEntitlements(
    { plan, status: "active", current_period_end: null },
    now
  );

  return {
    plan,
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    provider: null,
    providerSubscriptionId: null,
    entitlements,
    source: "profile",
  };
}

export async function getUserEntitlements(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<PlanEntitlements> {
  return (await getUserSubscription(supabase, userId, now)).entitlements;
}

export function canCreateWithinLimit(used: number, limit: number): boolean {
  return used < limit;
}
