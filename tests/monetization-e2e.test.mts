import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { NextRequest } from "next/server";
import { Document, Page, Text } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";
import {
  createStatefulStore,
  createStatefulSupabaseClient,
  type StatefulStore,
} from "./mocks/stateful-supabase.ts";
import { getUserSubscription } from "../lib/subscription/entitlements.ts";
import {
  createPlanCheckoutSession,
  PlanAlreadyActiveError,
} from "../lib/payments/checkout.ts";
import { handlePaymentWebhook } from "../lib/payments/webhook.ts";
import { PAID_PLANS } from "../lib/payments/plans.ts";
import type {
  CheckoutSessionRequest,
  PaymentProvider,
  WebhookEvent,
} from "../lib/payments/types.ts";

/**
 * Сквозная проверка монетизации (фаза 24, #71/#72/#73).
 *
 * Один сценарий проходит весь путь: checkout → webhook провайдера → тариф и
 * лимиты → создание проектов → экспорт PDF. Провайдер подменяется фейком
 * (тестовый режим), а состояние БД хранится в памяти, поэтому тест офлайн и
 * детерминирован.
 */

const USER = "user-1";
const FUTURE = "2027-10-10T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

let store: StatefulStore;
let currentUser: { id: string; email?: string } | null = { id: USER };
const capturedIsFree: boolean[] = [];

mock.module("../lib/supabase/server.ts", {
  namedExports: {
    createClient: async () =>
      createStatefulSupabaseClient({ store, user: currentUser }),
  },
});

// Заменяем сборщик отчёта, чтобы наблюдать флаг водяного знака, который
// маршрут экспорта выводит из серверной подписки.
mock.module("../lib/pdf/report.ts", {
  namedExports: {
    buildReportDocument: (snapshot: { isFree: boolean }) => {
      capturedIsFree.push(snapshot.isFree);
      return React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          null,
          React.createElement(Text, null, "report")
        )
      );
    },
  },
});

const { POST: projectsPost } = await import("../app/api/projects/route.ts");
const { POST: exportPost } = await import("../app/api/export/pdf/route.ts");

function supabase(): SupabaseClient<Database> {
  return createStatefulSupabaseClient({
    store,
    user: currentUser,
  }) as unknown as SupabaseClient<Database>;
}

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function recordingProvider(calls: CheckoutSessionRequest[]): PaymentProvider {
  return {
    name: "stripe",
    async createCheckoutSession(request) {
      calls.push(request);
      return {
        id: `cs_test_${calls.length}`,
        url: `https://checkout.stripe.test/cs_test_${calls.length}`,
      };
    },
    constructWebhookEvent() {
      throw new Error("не используется");
    },
  };
}

function providerReturning(event: WebhookEvent): PaymentProvider {
  return {
    name: "stripe",
    async createCheckoutSession() {
      throw new Error("не используется");
    },
    constructWebhookEvent() {
      return event;
    },
  };
}

function seedProjects(count: number) {
  for (let i = 0; i < count; i += 1) {
    store.projects.push({ id: `seed-${i}`, user_id: USER });
  }
}

function freeStore(): StatefulStore {
  return createStatefulStore({
    profiles: [{ id: USER, subscription_tier: "free" }],
    subscriptions: [{ user_id: USER, plan: "free", status: "active" }],
  });
}

async function payForPlan(plan: "pro" | "business") {
  const calls: CheckoutSessionRequest[] = [];
  const session = await createPlanCheckoutSession({
    supabase: supabase(),
    provider: recordingProvider(calls),
    user: { id: USER, email: "user@example.com" },
    plan,
    origin: "https://app.example.com",
  });

  const result = await handlePaymentWebhook({
    provider: providerReturning({
      id: `evt_${plan}`,
      type: "checkout.session.completed",
      data: {
        metadata: { user_id: USER, plan },
        subscription: `sub_${plan}`,
        customer: "cus_1",
      },
    }),
    supabase: supabase(),
    payload: "{}",
    signature: "sig",
  });

  return { calls, session, result };
}

const sampleBody = {
  project: { name: "Тестовый проект", description: "Описание" },
  result: {
    version: "1.0",
    total_base_hours: 120,
    total_adjusted_hours: 150,
    total_cost: 1234567,
    calendar_days: 45,
    roles: [],
    services: [],
    custom_service_fixed_cost: 0,
  },
  technology: {
    frontend: "React",
    backend: "Node",
    database: "Postgres",
    mobile: "",
  },
  teamRoles: [],
};

beforeEach(() => {
  store = freeStore();
  currentUser = { id: USER, email: "user@example.com" };
  capturedIsFree.length = 0;
});

// --- #71: оплата Профессионального → pro, лимит 20, PDF без знака ---

test("Pro: оплата через checkout и webhook включает тариф pro, лимит 20 и снимает водяной знак", async () => {
  const { calls, session, result } = await payForPlan("pro");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].plan, "pro");
  assert.equal(calls[0].userId, USER);
  assert.equal(calls[0].successUrl, "https://app.example.com/pricing?checkout=success&plan=pro");
  assert.ok(session.url.startsWith("https://checkout.stripe.test/"));
  assert.equal(result.status, "processed");

  const stored = store.subscriptions.get(USER);
  assert.equal(stored?.plan, "pro");
  assert.equal(stored?.status, "active");
  assert.equal(stored?.provider, "stripe");
  assert.equal(stored?.provider_subscription_id, "sub_pro");
  assert.equal(store.profiles.get(USER)?.subscription_tier, "pro");

  const subscription = await getUserSubscription(supabase(), USER);
  assert.equal(subscription.plan, "pro");
  assert.equal(subscription.entitlements.projectLimit, 20);
  assert.equal(subscription.entitlements.watermark, false);

  // Лимит проектов: 19 существующих → 20-й проходит, 21-й отклоняется.
  seedProjects(19);
  const allowed = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "Проект 20" })
  );
  assert.equal(allowed.status, 201);

  const denied = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "Проект 21" })
  );
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).error, /20/);

  // PDF без водяного знака для pro.
  const pdf = await exportPost(
    jsonRequest("http://localhost/api/export/pdf", sampleBody)
  );
  assert.equal(pdf.status, 200);
  assert.deepEqual(capturedIsFree, [false]);
});

// --- #72: оплата Бизнес → business, проекты не ограничены лимитом free ---

test("Business: оплата включает тариф business и проекты не ограничиваются лимитом free", async () => {
  const { calls, result } = await payForPlan("business");

  assert.equal(calls[0].plan, "business");
  assert.equal(result.status, "processed");
  assert.equal(PAID_PLANS.business.amount, 299);

  const subscription = await getUserSubscription(supabase(), USER);
  assert.equal(subscription.plan, "business");
  assert.ok(
    subscription.entitlements.projectLimit > 3,
    "лимит business должен превышать лимит free"
  );
  assert.equal(subscription.entitlements.watermark, false);

  // 25 существующих проектов — больше лимита free (3), но создание разрешено.
  seedProjects(25);
  const created = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "Проект 26" })
  );
  assert.equal(created.status, 201);

  const pdf = await exportPost(
    jsonRequest("http://localhost/api/export/pdf", sampleBody)
  );
  assert.equal(pdf.status, 200);
  assert.deepEqual(capturedIsFree, [false]);
});

// --- #73: отмена/окончание возвращает free, лимиты и знак восстанавливаются ---

test("Отмена подписки возвращает free, лимит 3 и водяной знак", async () => {
  store = createStatefulStore({
    profiles: [{ id: USER, subscription_tier: "pro" }],
    subscriptions: [
      {
        user_id: USER,
        plan: "pro",
        status: "active",
        current_period_end: FUTURE,
        provider: "stripe",
        provider_subscription_id: "sub_pro",
      },
    ],
  });

  const before = await getUserSubscription(supabase(), USER);
  assert.equal(before.plan, "pro");

  const result = await handlePaymentWebhook({
    provider: providerReturning({
      id: "evt_cancel",
      type: "customer.subscription.deleted",
      data: {
        id: "sub_pro",
        customer: "cus_1",
        metadata: { user_id: USER, plan: "pro" },
        current_period_end: FUTURE,
      },
    }),
    supabase: supabase(),
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");
  assert.equal(result.transition?.plan, "free");

  const after = await getUserSubscription(supabase(), USER);
  assert.equal(after.plan, "free");
  assert.equal(after.entitlements.projectLimit, 3);
  assert.equal(after.entitlements.watermark, true);
  assert.equal(store.profiles.get(USER)?.subscription_tier, "free");

  // Лимит free снова действует.
  seedProjects(3);
  const denied = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "Сверх лимита" })
  );
  assert.equal(denied.status, 403);

  const pdf = await exportPost(
    jsonRequest("http://localhost/api/export/pdf", sampleBody)
  );
  assert.equal(pdf.status, 200);
  assert.deepEqual(capturedIsFree, [true]);
});

test("Окончание периода без отмены возвращает free, лимиты и водяной знак", async () => {
  store = createStatefulStore({
    profiles: [{ id: USER, subscription_tier: "pro" }],
    subscriptions: [
      {
        user_id: USER,
        plan: "pro",
        status: "active",
        current_period_end: FUTURE,
        provider: "stripe",
        provider_subscription_id: "sub_pro",
      },
    ],
  });

  const result = await handlePaymentWebhook({
    provider: providerReturning({
      id: "evt_expired",
      type: "customer.subscription.updated",
      data: {
        id: "sub_pro",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: USER, plan: "pro" },
        current_period_start: PAST,
        current_period_end: PAST,
      },
    }),
    supabase: supabase(),
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");

  const after = await getUserSubscription(supabase(), USER);
  assert.equal(after.plan, "free");
  assert.equal(after.entitlements.projectLimit, 3);
  assert.equal(after.entitlements.watermark, true);
});

// --- защита от повторной оплаты активного плана ---

test("повторная оплата активного плана запрещена", async () => {
  store = createStatefulStore({
    profiles: [{ id: USER, subscription_tier: "pro" }],
    subscriptions: [
      {
        user_id: USER,
        plan: "pro",
        status: "active",
        current_period_end: FUTURE,
        provider: "stripe",
        provider_subscription_id: "sub_pro",
      },
    ],
  });

  const calls: CheckoutSessionRequest[] = [];
  await assert.rejects(
    () =>
      createPlanCheckoutSession({
        supabase: supabase(),
        provider: recordingProvider(calls),
        user: { id: USER, email: "user@example.com" },
        plan: "pro",
        origin: "https://app.example.com",
      }),
    PlanAlreadyActiveError
  );
  assert.equal(calls.length, 0, "новая сессия оплаты не создаётся");
});

// --- идемпотентность на сквозном уровне ---

test("повторная доставка webhook не меняет тариф дважды", async () => {
  const event: WebhookEvent = {
    id: "evt_pro",
    type: "checkout.session.completed",
    data: {
      metadata: { user_id: USER, plan: "pro" },
      subscription: "sub_pro",
      customer: "cus_1",
    },
  };

  const first = await handlePaymentWebhook({
    provider: providerReturning(event),
    supabase: supabase(),
    payload: "{}",
    signature: "sig",
  });
  const second = await handlePaymentWebhook({
    provider: providerReturning(event),
    supabase: supabase(),
    payload: "{}",
    signature: "sig",
  });

  assert.equal(first.status, "processed");
  assert.equal(second.status, "duplicate");

  const subscription = await getUserSubscription(supabase(), USER);
  assert.equal(subscription.plan, "pro");
});
