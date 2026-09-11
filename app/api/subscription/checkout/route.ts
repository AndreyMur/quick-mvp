import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createPlanCheckoutSession,
  getPaymentProvider,
  PlanAlreadyActiveError,
  PaymentProviderNotConfiguredError,
} from "@/lib/payments";
import { checkoutRequestSchema } from "@/lib/validations/payment";

/**
 * POST /api/subscription/checkout — создаёт платёжную сессию провайдера
 * для выбранного платного тарифа (фаза 22, #65).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
  }

  const validation = checkoutRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  try {
    const session = await createPlanCheckoutSession({
      supabase,
      provider: getPaymentProvider(),
      user: { id: user.id, email: user.email },
      plan: validation.data.plan,
      origin: request.nextUrl.origin,
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (error) {
    if (error instanceof PlanAlreadyActiveError) {
      return NextResponse.json(
        { error: "Этот тариф уже активен" },
        { status: 409 }
      );
    }
    if (error instanceof PaymentProviderNotConfiguredError) {
      console.error("Payment provider not configured:", error.message);
      return NextResponse.json(
        { error: "Платёжный провайдер не настроен" },
        { status: 503 }
      );
    }

    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Ошибка при создании платёжной сессии" },
      { status: 500 }
    );
  }
}
