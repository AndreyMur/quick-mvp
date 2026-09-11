import { createStripeProvider } from "@/lib/payments/stripe";
import {
  PaymentProviderNotConfiguredError,
  type PaymentProvider,
} from "@/lib/payments/types";

/**
 * Выбор платёжного провайдера по окружению (фаза 22).
 *
 * По умолчанию используется Stripe. Если ключи не заданы, функции,
 * требующие провайдера, возвращают 503, а не падают с неясной ошибкой.
 */

export function getPaymentProvider(): PaymentProvider {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new PaymentProviderNotConfiguredError("STRIPE_SECRET_KEY не задан");
  }

  return createStripeProvider({
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

export { PaymentProviderNotConfiguredError };
export * from "@/lib/payments/plans";
export * from "@/lib/payments/types";
export * from "@/lib/payments/checkout";
export * from "@/lib/payments/subscription-events";
export * from "@/lib/payments/webhook";
