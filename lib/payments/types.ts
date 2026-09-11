import type { PaidPlanId } from "@/lib/payments/plans";

/**
 * Провайдер-агностичный контракт платёжного провайдера (фаза 22, #65/#66).
 *
 * Позволяет держать бизнес-логику подписок независимой от Stripe и
 * подменять провайдера в тестах, не выходя в сеть.
 */

export interface CheckoutSessionRequest {
  userId: string;
  userEmail?: string | null;
  plan: PaidPlanId;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/** Нормализованное событие webhook, не зависящее от формата провайдера. */
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSession>;
  /**
   * Проверяет подпись и разбирает тело запроса. Должен бросить
   * `InvalidSignatureError`, если подпись отсутствует или неверна.
   */
  constructWebhookEvent(payload: string, signature: string | null): WebhookEvent;
}

/** Подпись webhook отсутствует или не совпадает с секретом. */
export class InvalidSignatureError extends Error {
  constructor(message = "Неверная подпись webhook") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}

/** Платёжный провайдер не сконфигурирован (нет ключей в окружении). */
export class PaymentProviderNotConfiguredError extends Error {
  constructor(message = "Платёжный провайдер не настроен") {
    super(message);
    this.name = "PaymentProviderNotConfiguredError";
  }
}
