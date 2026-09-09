import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const [
    { data: userRates },
    { data: userServiceHours },
    { data: customServices },
  ] = await Promise.all([
    supabase.from("user_rates").select("*").eq("user_id", user.id),
    supabase.from("user_service_hours").select("*").eq("user_id", user.id),
    supabase
      .from("custom_services")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    user_rates: userRates ?? [],
    user_service_hours: userServiceHours ?? [],
    custom_services: customServices ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json();

  // Update user_rates
  if (body.user_rates && Array.isArray(body.user_rates)) {
    for (const item of body.user_rates) {
      await supabase
        .from("user_rates")
        .upsert(
          { user_id: user.id, role: item.role, hourly_rate: item.hourly_rate } as never,
          { onConflict: "user_id,role" }
        );
    }
  }

  // Update user_service_hours
  if (body.user_service_hours && Array.isArray(body.user_service_hours)) {
    for (const item of body.user_service_hours) {
      await supabase
        .from("user_service_hours")
        .upsert(
          {
            user_id: user.id,
            service_key: item.service_key,
            hours: item.hours,
            fixed_cost: item.fixed_cost ?? null,
          } as never,
          { onConflict: "user_id,service_key" }
        );
    }
  }

  return NextResponse.json({ success: true });
}
