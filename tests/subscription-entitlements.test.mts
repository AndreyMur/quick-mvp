import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_ENTITLEMENTS,
  UNLIMITED_LIMIT,
  getUserEntitlements,
  getUserSubscription,
  isSubscriptionActive,
  normalizePlan,
  resolveEntitlements,
} from "../lib/subscription/entitlements.ts";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const FUTURE = "2026-10-10T00:00:00.000Z";
const PAST = "2026-08-10T00:00:00.000Z";

// --- активный тариф по статусам подписки (фаза 21, #63) ---

test("free: бесплатный план всегда даёт free-лимиты", () => {
  const entitlements = resolveEntitlements({ plan: "free", status: "active" }, NOW);

  assert.equal(entitlements.tier, "free");
  assert.equal(entitlements.projectLimit, 3);
  assert.equal(entitlements.customServicesLimit, 2);
  assert.equal(entitlements.watermark, true);
});

test("pro: active с будущим периодом даёт pro-лимиты", () => {
  const entitlements = resolveEntitlements(
    { plan: "pro", status: "active", current_period_end: FUTURE },
    NOW
  );

  assert.equal(entitlements.tier, "pro");
  assert.equal(entitlements.projectLimit, 20);
  assert.equal(entitlements.customServicesLimit, UNLIMITED_LIMIT);
  assert.equal(entitlements.watermark, false);
});

test("pro: active без периода (ручная выдача) остаётся активным", () => {
  const entitlements = resolveEntitlements(
    { plan: "pro", status: "active", current_period_end: null },
    NOW
  );

  assert.equal(entitlements.tier, "pro");
});

test("pro: trialing считается активным", () => {
  assert.equal(
    resolveEntitlements(
      { plan: "pro", status: "trialing", current_period_end: FUTURE },
      NOW
    ).tier,
    "pro"
  );
});

test("pro: past_due в пределах периода сохраняет доступ", () => {
  assert.equal(
    resolveEntitlements(
      { plan: "pro", status: "past_due", current_period_end: FUTURE },
      NOW
    ).tier,
    "pro"
  );
});

test("pro: past_due с истёкшим периодом возвращает free", () => {
  const entitlements = resolveEntitlements(
    { plan: "pro", status: "past_due", current_period_end: PAST },
    NOW
  );

  assert.equal(entitlements.tier, "free");
  assert.equal(entitlements.watermark, true);
});

test("pro: canceled до окончания периода сохраняет доступ до конца периода", () => {
  assert.equal(
    resolveEntitlements(
      { plan: "pro", status: "canceled", current_period_end: FUTURE },
      NOW
    ).tier,
    "pro"
  );
});

test("pro: canceled после окончания периода возвращает free", () => {
  const entitlements = resolveEntitlements(
    { plan: "pro", status: "canceled", current_period_end: PAST },
    NOW
  );

  assert.equal(entitlements.tier, "free");
  assert.equal(entitlements.watermark, true);
});

test("pro: canceled без периода возвращает free", () => {
  assert.equal(
    resolveEntitlements({ plan: "pro", status: "canceled" }, NOW).tier,
    "free"
  );
});

test("pro: незавершённые/неоплаченные статусы возвращают free", () => {
  for (const status of [
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "unknown",
  ]) {
    assert.equal(
      resolveEntitlements(
        { plan: "pro", status, current_period_end: FUTURE },
        NOW
      ).tier,
      "free",
      `статус ${status} не должен давать pro`
    );
  }
});

test("business: active даёт безлимитные проекты и сервисы без знака", () => {
  const entitlements = resolveEntitlements(
    { plan: "business", status: "active", current_period_end: FUTURE },
    NOW
  );

  assert.equal(entitlements.tier, "business");
  assert.equal(entitlements.projectLimit, UNLIMITED_LIMIT);
  assert.equal(entitlements.customServicesLimit, UNLIMITED_LIMIT);
  assert.equal(entitlements.watermark, false);
  assert.ok(
    entitlements.projectLimit > PLAN_ENTITLEMENTS.free.projectLimit,
    "лимит business не должен ограничиваться лимитом free"
  );
});

test("неизвестный/отсутствующий план трактуется как free", () => {
  for (const plan of ["enterprise", "", null, undefined, 42]) {
    const entitlements = resolveEntitlements(
      { plan: plan as string, status: "active" },
      NOW
    );
    assert.equal(entitlements.tier, "free");
    assert.equal(entitlements.watermark, true);
  }
});

test("isSubscriptionActive: активные статусы и истёкший период", () => {
  assert.equal(isSubscriptionActive({ status: "active" }, NOW), true);
  assert.equal(isSubscriptionActive({ status: "trialing" }, NOW), true);
  assert.equal(
    isSubscriptionActive({ status: "active", current_period_end: FUTURE }, NOW),
    true
  );
  assert.equal(
    isSubscriptionActive({ status: "active", current_period_end: PAST }, NOW),
    false
  );
  assert.equal(isSubscriptionActive({ status: "canceled" }, NOW), false);
  assert.equal(isSubscriptionActive({ status: null }, NOW), false);
});

test("normalizePlan: допустимые планы сохраняются, прочие — free", () => {
  assert.equal(normalizePlan("free"), "free");
  assert.equal(normalizePlan("pro"), "pro");
  assert.equal(normalizePlan("business"), "business");
  assert.equal(normalizePlan("gold"), "free");
});

// --- чтение подписки из БД (фаза 21, #63) ---

let serverOptions: MockSupabaseOptions = {};

mock.module("../lib/supabase/server.ts", {
  namedExports: {
    createClient: async () => createMockSupabaseClient(serverOptions),
  },
});

async function clientWith() {
  const { createClient } = await import("../lib/supabase/server.ts");
  return createClient();
}

test("getUserEntitlements: читает план из таблицы subscriptions", async () => {
  serverOptions = {
    user: { id: "user-1" },
    responses: {
      subscriptions: {
        data: {
          plan: "pro",
          status: "active",
          current_period_end: FUTURE,
          cancel_at_period_end: false,
          provider: "stripe",
          provider_subscription_id: "sub_123",
        },
        error: null,
      },
    },
  };

  const supabase = await clientWith();
  const entitlements = await getUserEntitlements(supabase, "user-1", NOW);

  assert.equal(entitlements.tier, "pro");
  assert.equal(entitlements.watermark, false);

  const query = (supabase as unknown as { queries: Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }> }).queries.find(
    (q) => q.table === "subscriptions"
  );
  assert.ok(query, "должен быть запрос к таблице subscriptions");
  assert.ok(
    query.calls.some(
      (call) =>
        call.method === "eq" && call.args[0] === "user_id" && call.args[1] === "user-1"
    ),
    "подписка должна выбираться по user_id"
  );
});

test("getUserSubscription: возвращает период и флаг отмены", async () => {
  serverOptions = {
    user: { id: "user-1" },
    responses: {
      subscriptions: {
        data: {
          plan: "pro",
          status: "canceled",
          current_period_end: FUTURE,
          cancel_at_period_end: true,
          provider: "stripe",
          provider_subscription_id: "sub_123",
        },
        error: null,
      },
    },
  };

  const supabase = await clientWith();
  const subscription = await getUserSubscription(supabase, "user-1", NOW);

  assert.equal(subscription.source, "subscription");
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.status, "canceled");
  assert.equal(subscription.currentPeriodEnd, FUTURE);
  assert.equal(subscription.cancelAtPeriodEnd, true);
  assert.equal(subscription.provider, "stripe");
});

test("getUserEntitlements: при отсутствии подписки тариф берётся из профиля", async () => {
  serverOptions = {
    user: { id: "user-1" },
    responses: {
      profiles: { data: { subscription_tier: "pro" }, error: null },
    },
  };

  const supabase = await clientWith();
  const subscription = await getUserSubscription(supabase, "user-1", NOW);

  assert.equal(subscription.source, "profile");
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.entitlements.projectLimit, 20);
});

test("getUserEntitlements: отсутствие и подписки, и профиля трактуется как free", async () => {
  serverOptions = { user: { id: "user-1" } };

  const supabase = await clientWith();
  const entitlements = await getUserEntitlements(supabase, "user-1", NOW);

  assert.equal(entitlements.tier, "free");
  assert.equal(entitlements.watermark, true);
});
