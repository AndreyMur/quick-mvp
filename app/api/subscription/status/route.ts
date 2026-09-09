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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_tier, project_limit, custom_services_limit")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке статуса подписки" },
      { status: 500 }
    );
  }

  const p = profile as {
    subscription_tier: string;
    project_limit: number;
    custom_services_limit: number;
  } | null;

  return NextResponse.json({
    subscription_tier: p?.subscription_tier ?? "free",
    project_limit: p?.project_limit ?? 3,
    custom_services_limit: p?.custom_services_limit ?? 2,
  });
}
