import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPaymentProvider,
  handlePaymentWebhook,
  InvalidSignatureError,
  PaymentProviderNotConfiguredError,
} from "@/lib/payments";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe — приём событий подписки (фаза 22, #66).
 *
 * Тело читается как сырой текст (Stripe подписывает именно его). Запись
 * выполняется service-role клиентом: подписку меняет только провайдер,
 * RLS запрещает это пользователю.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  try {
    const provider = getPaymentProvider();
    const supabase = createAdminClient();

    const result = await handlePaymentWebhook({
      provider,
      supabase,
      payload,
      signature,
    });

    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    if (error instanceof InvalidSignatureError) {
      return NextResponse.json({ error: "Неверная подпись" }, { status: 400 });
    }
    if (error instanceof PaymentProviderNotConfiguredError) {
      console.error("Payment provider not configured:", error.message);
      return NextResponse.json(
        { error: "Платёжный провайдер не настроен" },
        { status: 503 }
      );
    }

    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Ошибка обработки webhook" },
      { status: 500 }
    );
  }
}
