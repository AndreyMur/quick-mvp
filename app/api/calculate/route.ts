import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateInputSchema } from "@/lib/validations/calculate";
import { calculateProject } from "@/lib/calculate";
import type { CalculationReferences } from "@/lib/types/project";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json();
  const validation = calculateInputSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  // --- Read all reference data at the caller level ---
  const [
    globalRates,
    globalServiceHours,
    userRates,
    userServiceHours,
    customServices,
    technologyCoefficients,
  ] = await Promise.all([
    supabase.from("global_rates").select("*"),
    supabase.from("global_service_hours").select("*"),
    supabase.from("user_rates").select("*").eq("user_id", user.id),
    supabase.from("user_service_hours").select("*").eq("user_id", user.id),
    supabase
      .from("custom_services")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`),
    supabase.from("technology_coefficients").select("*"),
  ]);

  const references: CalculationReferences = {
    globalRates: globalRates.data ?? [],
    globalServiceHours: globalServiceHours.data ?? [],
    userRates: userRates.data ?? [],
    userServiceHours: userServiceHours.data ?? [],
    customServices: customServices.data ?? [],
    technologyCoefficients: technologyCoefficients.data ?? [],
  };

  try {
    const result = calculateProject(validation.data, references);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { error: "Ошибка при расчёте" },
      { status: 500 }
    );
  }
}
