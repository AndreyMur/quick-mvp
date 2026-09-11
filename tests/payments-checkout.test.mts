import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";
import type { Database } from "../lib/supabase/database.types.ts";
import {
  createPlanCheckoutSession,
  PlanAlreadyActiveError,
} from "../lib/payments/checkout.ts";
import { PAID_PLANS, toMinorUnits } from "../lib/payments/plans.ts";
import type {
  CheckoutSessionRequest,
  PaymentProvider,
} from "../lib/payments/types.ts";

/**
 * Тесты создания checkout-сессии (фаза 22, #65).
 *
 * Провайдер — фейк, записывающий запрос, поэтому тесты офлайн.
 */

interface RecordedCall {
  request: CheckoutSessionRequest;
}

function recordingProvider(calls: RecordedCall[]): PaymentProvider {
  return {
    name: "stripe",
    async createCheckoutSession(request) {
      calls.push({ request });
      return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
    },
    constructWebhookEvent() {
      throw new Error("не используется");
    },
  };
}

const FUTURE = "2027-10-10T00:00:00.000Z";

function asClient(options: MockSupabaseOptions): SupabaseClient<Database> {
  return createMockSupabaseClient(options) as unknown as SupabaseClient<Database>;
}

function freeClient(): MockSupabaseOptions {
  return {
    responses: {
      subscriptions: { data: null, error: null },
      profiles: { data: { subscription_tier: "free" }, error: null },
    },
  };
}

test("цены тарифов согласованы: Pro 99, Business 299", () => {
  assert.equal(PAID_PLANS.pro.amount, 99);
  assert.equal(PAID_PLANS.business.amount, 299);
});

test("toMinorUnits переводит цену в минимальные единицы валюты", () => {
  assert.equal(toMinorUnits(99, "usd"), 9900);
  assert.equal(toMinorUnits(299, "usd"), 29900);
  assert.equal(toMinorUnits(99, "jpy"), 99);
});

test("createPlanCheckoutSession создаёт сессию для pro с success/cancel URL", async () => {
  const calls: RecordedCall[] = [];
  const supabase = asClient(freeClient());

  const session = await createPlanCheckoutSession({
    supabase,
    provider: recordingProvider(calls),
    user: { id: "user-1", email: "user@example.com" },
    plan: "pro",
    origin: "https://app.example.com/",
  });

  assert.equal(session.url, "https://checkout.stripe.test/cs_test_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.plan, "pro");
  assert.equal(calls[0].request.userId, "user-1");
  assert.equal(
    calls[0].request.successUrl,
    "https://app.example.com/pricing?checkout=success&plan=pro"
  );
  assert.equal(
    calls[0].request.cancelUrl,
    "https://app.example.com/pricing?checkout=cancelled&plan=pro"
  );
});

test("createPlanCheckoutSession запрещает повторную оплату активного тарифа", async () => {
  const calls: RecordedCall[] = [];
  const supabase = asClient({
    responses: {
      subscriptions: {
        data: {
          plan: "pro",
          status: "active",
          current_period_end: FUTURE,
          cancel_at_period_end: false,
          provider: "stripe",
          provider_subscription_id: "sub_1",
        },
        error: null,
      },
    },
  });

  await assert.rejects(
    () =>
      createPlanCheckoutSession({
        supabase,
        provider: recordingProvider(calls),
        user: { id: "user-1", email: "user@example.com" },
        plan: "pro",
        origin: "https://app.example.com",
      }),
    PlanAlreadyActiveError
  );

  assert.equal(calls.length, 0, "сессия не должна создаваться");
});

test("createPlanCheckoutSession разрешает переход pro → business", async () => {
  const calls: RecordedCall[] = [];
  const supabase = asClient({
    responses: {
      subscriptions: {
        data: {
          plan: "pro",
          status: "active",
          current_period_end: FUTURE,
          cancel_at_period_end: false,
          provider: "stripe",
          provider_subscription_id: "sub_1",
        },
        error: null,
      },
    },
  });

  await createPlanCheckoutSession({
    supabase,
    provider: recordingProvider(calls),
    user: { id: "user-1", email: "user@example.com" },
    plan: "business",
    origin: "https://app.example.com",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.plan, "business");
});

// --- HTTP-слой (401/400/503) ---

let serverOptions: MockSupabaseOptions = {};

mock.module("../lib/supabase/server.ts", {
  namedExports: {
    createClient: async () => createMockSupabaseClient(serverOptions),
  },
});

const { POST: checkoutPost } = await import(
  "../app/api/subscription/checkout/route.ts"
);

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/subscription/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  serverOptions = {};
});

test("POST /api/subscription/checkout без авторизации → 401", async () => {
  serverOptions = { user: null };

  const response = await checkoutPost(jsonRequest({ plan: "pro" }));

  assert.equal(response.status, 401);
});

test("POST /api/subscription/checkout с неверным тарифом → 400", async () => {
  serverOptions = { user: { id: "user-1", email: "user@example.com" } };

  const response = await checkoutPost(jsonRequest({ plan: "free" }));

  assert.equal(response.status, 400);
});

test("POST /api/subscription/checkout без ключей провайдера → 503", async () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  serverOptions = { user: { id: "user-1", email: "user@example.com" } };

  try {
    const response = await checkoutPost(jsonRequest({ plan: "pro" }));
    assert.equal(response.status, 503);
  } finally {
    if (previous !== undefined) process.env.STRIPE_SECRET_KEY = previous;
  }
});
