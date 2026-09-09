import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateInputSchema } from "@/lib/validations/calculate";
import { calculateProject } from "@/lib/calculate";

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

  try {
    const result = await calculateProject(user.id, validation.data);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { error: "Ошибка при расчёте" },
      { status: 500 }
    );
  }
}
