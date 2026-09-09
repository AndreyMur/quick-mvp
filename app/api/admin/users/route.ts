import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateUserSchema } from "@/lib/validations/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }), supabase: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const p = profile as { is_admin?: boolean } | null;
  if (!p?.is_admin) {
    return { error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }), supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

export async function GET() {
  const check = await checkAdmin();
  if (check.error) return check.error;
  const { supabase } = check;
  if (!supabase) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  const { data: users, error } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      is_admin,
      subscription_tier,
      project_limit,
      custom_services_limit,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Ошибка при загрузке пользователей" }, { status: 500 });
  }

  // Count projects for each user
  const usersWithCounts = await Promise.all(
    (users ?? []).map(async (u: Record<string, unknown>) => {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id as string);
      return { ...u, project_count: count ?? 0 };
    })
  );

  return NextResponse.json({ users: usersWithCounts });
}

export async function PUT(request: NextRequest) {
  const check = await checkAdmin();
  if (check.error) return check.error;
  const { supabase, user } = check;
  if (!supabase || !user) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  const body = await request.json();
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("id");

  if (!targetUserId) {
    return NextResponse.json({ error: "ID пользователя не указан" }, { status: 400 });
  }

  // Prevent admin from removing their own admin status
  if (targetUserId === user.id && body.is_admin === false) {
    return NextResponse.json({ error: "Нельзя снять права администратора с себя" }, { status: 400 });
  }

  const validation = updateUserSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (validation.data.project_limit !== undefined) updateData.project_limit = validation.data.project_limit;
  if (validation.data.is_admin !== undefined) updateData.is_admin = validation.data.is_admin;
  if (validation.data.subscription_tier !== undefined) updateData.subscription_tier = validation.data.subscription_tier;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updateData as never)
    .eq("id", targetUserId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Ошибка при обновлении пользователя" }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

export async function DELETE(request: NextRequest) {
  const check = await checkAdmin();
  if (check.error) return check.error;
  const { supabase, user } = check;
  if (!supabase || !user) return NextResponse.json({ error: "Internal error" }, { status: 500 });

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("id");

  if (!targetUserId) {
    return NextResponse.json({ error: "ID пользователя не указан" }, { status: 400 });
  }

  // Prevent admin from deleting themselves
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Нельзя удалить себя" }, { status: 400 });
  }

  // Delete from profiles (auth user remains, will be cleaned up later)
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", targetUserId);

  if (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Ошибка при удалении пользователя" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
