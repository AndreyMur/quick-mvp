import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProjectSchema } from "@/lib/validations/project";
import { getUserEntitlements } from "@/lib/subscription/entitlements";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке проектов" },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects });
}

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
  const validation = createProjectSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { name, description } = validation.data;

  // Enforce the project limit from the subscription-based entitlements.
  const entitlements = await getUserEntitlements(supabase, user.id);

  const { count: projectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((projectsCount ?? 0) >= entitlements.projectLimit) {
    return NextResponse.json(
      { error: `Лимит проектов (${entitlements.projectLimit}) исчерпан` },
      { status: 403 }
    );
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      description: description ?? null,
      status: "draft",
    } as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Ошибка при создании проекта" },
      { status: 500 }
    );
  }

  return NextResponse.json({ project }, { status: 201 });
}
