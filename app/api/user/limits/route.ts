import { NextResponse } from "next/server";
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_tier, project_limit, custom_services_limit")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return NextResponse.json(
      { error: "Ошибка при загрузке профиля" },
      { status: 500 }
    );
  }

  const { count: projectsCount, error: projectsError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (projectsError) {
    console.error("Error counting projects:", projectsError);
    return NextResponse.json(
      { error: "Ошибка при подсчёте проектов" },
      { status: 500 }
    );
  }

  const limits = profile as unknown as {
    subscription_tier: string;
    project_limit: number;
    custom_services_limit: number;
  };

  const projectsUsed = projectsCount ?? 0;
  const canCreateProject = projectsUsed < (limits.project_limit ?? 3);

  return NextResponse.json({
    subscription_tier: limits.subscription_tier,
    project_limit: limits.project_limit,
    custom_services_limit: limits.custom_services_limit,
    projects_used: projectsUsed,
    can_create_project: canCreateProject,
  });
}
