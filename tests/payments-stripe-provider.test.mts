import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createStripeProvider } from "../lib/payments/stripe.ts";
import {
  InvalidSignatureError,
  PaymentProviderNotConfiguredError,
} from "../lib/payments/types.ts";

/**
 * Проверка подписи webhook реальным SDK Stripe (фаза 22, #66).
 *
 * Подпись генерируется тестовым хелпером Stripe, сеть не используется.
 */

const WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_dummy");

function provider(webhookSecret: string | null = WEBHOOK_SECRET) {
  return createStripeProvider({ secretKey: "sk_test_dummy", webhookSecret });
}

test("валидная подпись: событие разбирается в нормализованный вид", async () => {
  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: { metadata: { user_id: "u1", plan: "pro" }, subscription: "sub_1" },
    },
  });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: WEBHOOK_SECRET,
  });

  const event = provider().constructWebhookEvent(payload, header);

  assert.equal(event.id, "evt_1");
  assert.equal(event.type, "checkout.session.completed");
});

test("подпись чужим секретом отклоняется", async () => {
  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: {} },
  });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: "whsec_other_secret",
  });

  assert.throws(
    () => provider().constructWebhookEvent(payload, header),
    InvalidSignatureError
  );
});

test("отсутствующая подпись отклоняется", () => {
  assert.throws(
    () => provider().constructWebhookEvent("{}", null),
    InvalidSignatureError
  );
});

test("без STRIPE_WEBHOOK_SECRET провайдер считается ненастроенным", () => {
  assert.throws(
    () => provider(null).constructWebhookEvent("{}", "sig"),
    PaymentProviderNotConfiguredError
  );
});
