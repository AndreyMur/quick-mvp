import Stripe from "stripe";
import { PAID_PLANS, getPaymentCurrency, toMinorUnits } from "@/lib/payments/plans";
import {
  InvalidSignatureError,
  PaymentProviderNotConfiguredError,
  type PaymentProvider,
  type WebhookEvent,
} from "@/lib/payments/types";

/**
 * Реализация платёжного провайдера на Stripe (тестовый режим) — фаза 22.
 *
 * Ключи берутся из окружения; для тестового режима используются ключи
 * Stripe вида `sk_test_...` и `whsec_...` из тестового вебхука.
 */

export interface StripeProviderConfig {
  secretKey: string;
  webhookSecret?: string | null;
}

export function createStripeProvider({
  secretKey,
  webhookSecret,
}: StripeProviderConfig): PaymentProvider {
  const stripe = new Stripe(secretKey);

  return {
    name: "stripe",

    async createCheckoutSession(request) {
      const plan = PAID_PLANS[request.plan];
      const currency = getPaymentCurrency();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: request.userEmail ?? undefined,
        client_reference_id: request.userId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: toMinorUnits(plan.amount, currency),
              recurring: { interval: plan.interval },
              product_data: {
                name: `MVP Calculator — ${plan.name}`,
              },
            },
          },
        ],
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        metadata: { user_id: request.userId, plan: request.plan },
        subscription_data: {
          metadata: { user_id: request.userId, plan: request.plan },
        },
      });

      if (!session.url) {
        throw new Error("Stripe не вернул URL платёжной сессии");
      }

      return { id: session.id, url: session.url };
    },

    constructWebhookEvent(payload: string, signature: string | null): WebhookEvent {
      if (!webhookSecret) {
        throw new PaymentProviderNotConfiguredError(
          "STRIPE_WEBHOOK_SECRET не задан"
        );
      }
      if (!signature) {
        throw new InvalidSignatureError("Отсутствует заголовок подписи");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch {
        throw new InvalidSignatureError();
      }

      return {
        id: event.id,
        type: event.type,
        data: event.data.object as unknown as Record<string, unknown>,
      };
    },
  };
}
