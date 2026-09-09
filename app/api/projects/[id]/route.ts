import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProjectSchema } from "@/lib/validations/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке проекта" },
      { status: 500 }
    );
  }

  return NextResponse.json({ project });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json();
  const validation = updateProjectSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (validation.data.name !== undefined) updateData.name = validation.data.name;
  if (validation.data.description !== undefined) updateData.description = validation.data.description;
  if (validation.data.status !== undefined) updateData.status = validation.data.status;
  if (validation.data.data !== undefined) updateData.data = validation.data.data;

  const { data: project, error } = await supabase
    .from("projects")
    .update(updateData as never)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Ошибка при обновлении проекта" },
      { status: 500 }
    );
  }

  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении проекта" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
