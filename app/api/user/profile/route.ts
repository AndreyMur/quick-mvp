import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validations/profile";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке профиля" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
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
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { full_name } = validation.data;

  const updateData: Record<string, unknown> = {};
  if (full_name !== undefined) updateData.full_name = full_name;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updateData as never)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Ошибка при обновлении профиля" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
}
