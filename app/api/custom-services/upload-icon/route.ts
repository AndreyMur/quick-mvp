import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  // Validate file type
  if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
    return NextResponse.json(
      { error: "Допустимы только PNG и SVG файлы" },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { data, error } = await supabase.storage
    .from("custom-service-icons")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке файла" },
      { status: 500 }
    );
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage
    .from("custom-service-icons")
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
