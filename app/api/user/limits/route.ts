import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canCreateWithinLimit,
  getUserEntitlements,
} from "@/lib/subscription/entitlements";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const entitlements = await getUserEntitlements(supabase, user.id);

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

  const projectsUsed = projectsCount ?? 0;

  return NextResponse.json({
    subscription_tier: entitlements.tier,
    project_limit: entitlements.projectLimit,
    custom_services_limit: entitlements.customServicesLimit,
    watermark: entitlements.watermark,
    projects_used: projectsUsed,
    can_create_project: canCreateWithinLimit(
      projectsUsed,
      entitlements.projectLimit
    ),
  });
}
