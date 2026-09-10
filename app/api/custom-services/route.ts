import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/subscription/entitlements";
import { z } from "zod";

const customServiceSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  hours: z.number().int().min(0),
  fixed_cost: z.number().int().nullable().optional(),
  icon_url: z.string().url().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Check limit from the subscription-based entitlements.
  const entitlements = await getUserEntitlements(supabase, user.id);

  const { count } = await supabase
    .from("custom_services")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const limit = entitlements.customServicesLimit;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Лимит кастомных сервисов (${limit}) исчерпан` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const validation = customServiceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("custom_services")
    .insert({
      user_id: user.id,
      name: validation.data.name,
      hours: validation.data.hours,
      fixed_cost: validation.data.fixed_cost ?? null,
      icon_url: validation.data.icon_url ?? null,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating custom service:", error);
    return NextResponse.json({ error: "Ошибка при создании" }, { status: 500 });
  }

  return NextResponse.json({ service: data }, { status: 201 });
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

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("id");

  if (!serviceId) {
    return NextResponse.json({ error: "ID не указан" }, { status: 400 });
  }

  const body = await request.json();
  const validation = customServiceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("custom_services")
    .update({
      name: validation.data.name,
      hours: validation.data.hours,
      fixed_cost: validation.data.fixed_cost ?? null,
      icon_url: validation.data.icon_url ?? null,
    } as never)
    .eq("id", serviceId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating custom service:", error);
    return NextResponse.json({ error: "Ошибка при обновлении" }, { status: 500 });
  }

  return NextResponse.json({ service: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("id");

  if (!serviceId) {
    return NextResponse.json({ error: "ID не указан" }, { status: 400 });
  }

  const { error } = await supabase
    .from("custom_services")
    .delete()
    .eq("id", serviceId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting custom service:", error);
    return NextResponse.json({ error: "Ошибка при удалении" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
