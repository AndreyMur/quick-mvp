import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/subscription/entitlements";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const subscription = await getUserSubscription(supabase, user.id);

  return NextResponse.json({
    subscription_tier: subscription.plan,
    status: subscription.status,
    project_limit: subscription.entitlements.projectLimit,
    custom_services_limit: subscription.entitlements.customServicesLimit,
    watermark: subscription.entitlements.watermark,
    current_period_end: subscription.currentPeriodEnd,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    provider: subscription.provider,
  });
}
