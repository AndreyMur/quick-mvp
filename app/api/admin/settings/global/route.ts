import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }), supabase: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const p = profile as { is_admin?: boolean } | null;
  if (!p?.is_admin) {
    return { error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }), supabase: null };
  }

  return { error: null, supabase };
}

export async function GET() {
  const check = await checkAdmin();
  if (check.error) return check.error;
  const { supabase } = check;
  if (!supabase) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  const [
    { data: globalRates },
    { data: globalServiceHours },
    { data: techCoeffs },
  ] = await Promise.all([
    supabase.from("global_rates").select("*").order("role"),
    supabase.from("global_service_hours").select("*").order("service_key"),
    supabase.from("technology_coefficients").select("*").order("technology_key"),
  ]);

  return NextResponse.json({
    global_rates: globalRates ?? [],
    global_service_hours: globalServiceHours ?? [],
    technology_coefficients: techCoeffs ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const check = await checkAdmin();
  if (check.error) return check.error;
  const { supabase } = check;
  if (!supabase) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  const body = await request.json();

  const results: { rates?: unknown; hours?: unknown; coefficients?: unknown } = {};

  // Update global_rates
  if (body.global_rates && Array.isArray(body.global_rates)) {
    for (const item of body.global_rates) {
      const { error } = await supabase
        .from("global_rates")
        .update({ hourly_rate: item.hourly_rate } as never)
        .eq("role", item.role);
      if (error) {
        console.error("Error updating rate:", error);
        return NextResponse.json({ error: `Ошибка обновления ставки: ${item.role}` }, { status: 500 });
      }
    }
    results.rates = body.global_rates;
  }

  // Update global_service_hours
  if (body.global_service_hours && Array.isArray(body.global_service_hours)) {
    for (const item of body.global_service_hours) {
      const { error } = await supabase
        .from("global_service_hours")
        .update({ hours: item.hours, fixed_cost: item.fixed_cost ?? null } as never)
        .eq("service_key", item.service_key);
      if (error) {
        console.error("Error updating service hours:", error);
        return NextResponse.json({ error: `Ошибка обновления нормативов: ${item.service_key}` }, { status: 500 });
      }
    }
    results.hours = body.global_service_hours;
  }

  // Update technology_coefficients
  if (body.technology_coefficients && Array.isArray(body.technology_coefficients)) {
    for (const item of body.technology_coefficients) {
      const { error } = await supabase
        .from("technology_coefficients")
        .update({ coefficient: item.coefficient } as never)
        .eq("technology_key", item.technology_key);
      if (error) {
        console.error("Error updating coefficient:", error);
        return NextResponse.json({ error: `Ошибка обновления коэффициента: ${item.technology_key}` }, { status: 500 });
      }
    }
    results.coefficients = body.technology_coefficients;
  }

  return NextResponse.json({ success: true, ...results });
}
