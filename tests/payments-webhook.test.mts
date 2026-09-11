import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";
import type { Database } from "../lib/supabase/database.types.ts";
import {
  handlePaymentWebhook,
} from "../lib/payments/webhook.ts";
import {
  InvalidSignatureError,
  type PaymentProvider,
  type WebhookEvent,
} from "../lib/payments/types.ts";

/**
 * Тесты обработки webhook подписки (фаза 22, #66/#67).
 *
 * Провайдер подменяется фейком, поэтому тесты полностью офлайн и не зависят
 * от ключей Stripe. Проверяются переходы состояния и идемпотентность.
 */

function fakeProvider(
  handler: (payload: string, signature: string | null) => WebhookEvent
): PaymentProvider {
  return {
    name: "stripe",
    createCheckoutSession() {
      throw new Error("createCheckoutSession не используется в тестах webhook");
    },
    constructWebhookEvent: handler,
  };
}

function event(
  id: string,
  type: string,
  data: Record<string, unknown>
): WebhookEvent {
  return { id, type, data };
}

type TestClient = SupabaseClient<Database> &
  ReturnType<typeof createMockSupabaseClient>;

function clientWith(options: MockSupabaseOptions = {}): TestClient {
  return createMockSupabaseClient(options) as unknown as TestClient;
}

function findUpsertPayload(
  supabase: TestClient,
  table: string
): Record<string, unknown> | null {
  const query = supabase.queries.find(
    (q) => q.table === table && q.calls.some((c) => c.method === "upsert")
  );
  if (!query) return null;
  const call = query.calls.find((c) => c.method === "upsert");
  return (call?.args[0] as Record<string, unknown>) ?? null;
}

// --- оплата активирует план (#67) ---

test("checkout.session.completed активирует оплаченный тариф", async () => {
  const supabase = clientWith();
  const provider = fakeProvider(() =>
    event("evt_paid", "checkout.session.completed", {
      metadata: { user_id: "user-1", plan: "pro" },
      subscription: "sub_1",
      customer: "cus_1",
    })
  );

  const result = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");
  assert.equal(result.transition?.plan, "pro");
  assert.equal(result.transition?.status, "active");

  const payload = findUpsertPayload(supabase, "subscriptions");
  assert.ok(payload, "должен быть upsert в subscriptions");
  assert.equal(payload.user_id, "user-1");
  assert.equal(payload.plan, "pro");
  assert.equal(payload.status, "active");
  assert.equal(payload.provider, "stripe");
  assert.equal(payload.provider_subscription_id, "sub_1");
  assert.equal(payload.provider_customer_id, "cus_1");
});

test("customer.subscription.updated синхронизирует статус, период и флаг отмены", async () => {
  const supabase = clientWith();
  const provider = fakeProvider(() =>
    event("evt_upd", "customer.subscription.updated", {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { user_id: "user-1", plan: "business" },
      current_period_start: 1790000000,
      current_period_end: 1792592000,
      cancel_at_period_end: true,
    })
  );

  const result = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");
  const payload = findUpsertPayload(supabase, "subscriptions");
  assert.ok(payload);
  assert.equal(payload.plan, "business");
  assert.equal(payload.cancel_at_period_end, true);
  assert.equal(payload.current_period_end, new Date(1792592000 * 1000).toISOString());
});

// --- отмена/окончание возвращает free (#67) ---

test("customer.subscription.deleted возвращает тариф free", async () => {
  const supabase = clientWith();
  const provider = fakeProvider(() =>
    event("evt_del", "customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { user_id: "user-1", plan: "pro" },
      current_period_end: 1792592000,
    })
  );

  const result = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");
  assert.equal(result.transition?.plan, "free");
  assert.equal(result.transition?.status, "canceled");

  const payload = findUpsertPayload(supabase, "subscriptions");
  assert.equal(payload?.plan, "free");
  assert.equal(payload?.status, "canceled");
});

test("invoice.payment_failed переводит подписку в past_due (доступ до конца периода)", async () => {
  const supabase = clientWith({
    responses: {
      subscriptions: { data: { user_id: "user-1" }, error: null },
    },
  });
  const provider = fakeProvider(() =>
    event("evt_fail", "invoice.payment_failed", {
      subscription: "sub_1",
      customer: "cus_1",
      metadata: { plan: "pro" },
      period_end: 1792592000,
    })
  );

  const result = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "processed");
  assert.equal(result.transition?.userId, "user-1");
  assert.equal(result.transition?.status, "past_due");
});

// --- идемпотентность (#66) ---

test("повторная доставка события не применяет переход дважды", async () => {
  let inserts = 0;
  const supabase = clientWith({
    responses: {
      payment_events: () => {
        inserts += 1;
        return inserts === 1
          ? { data: null, error: null }
          : { data: null, error: { message: "duplicate key", code: "23505" } };
      },
    },
  });
  const provider = fakeProvider(() =>
    event("evt_same", "checkout.session.completed", {
      metadata: { user_id: "user-1", plan: "pro" },
      subscription: "sub_1",
      customer: "cus_1",
    })
  );

  const first = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });
  const second = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(first.status, "processed");
  assert.equal(second.status, "duplicate");

  const upserts = supabase.queries.filter(
    (q) => q.table === "subscriptions" && q.calls.some((c) => c.method === "upsert")
  );
  assert.equal(upserts.length, 1, "подписка должна обновиться ровно один раз");
});

// --- проверка подписи (#66) ---

test("неверная подпись отклоняется и ничего не записывается", async () => {
  const supabase = clientWith();
  const provider = fakeProvider(() => {
    throw new InvalidSignatureError();
  });

  await assert.rejects(
    () =>
      handlePaymentWebhook({
        provider,
        supabase,
        payload: "{}",
        signature: "bad",
      }),
    InvalidSignatureError
  );

  assert.equal(supabase.queries.length, 0, "при неверной подписи БД не трогается");
});

test("неизвестное событие игнорируется без записи подписки", async () => {
  const supabase = clientWith();
  const provider = fakeProvider(() =>
    event("evt_other", "customer.created", { id: "cus_1" })
  );

  const result = await handlePaymentWebhook({
    provider,
    supabase,
    payload: "{}",
    signature: "sig",
  });

  assert.equal(result.status, "ignored");
  assert.equal(
    supabase.queries.filter((q) => q.table === "subscriptions").length,
    0
  );
});
