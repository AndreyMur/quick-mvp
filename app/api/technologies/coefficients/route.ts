import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: coefficients, error } = await supabase
    .from("technology_coefficients")
    .select("*")
    .order("technology_key");

  if (error) {
    console.error("Error fetching coefficients:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке коэффициентов" },
      { status: 500 }
    );
  }

  return NextResponse.json({ coefficients: coefficients ?? [] });
}
