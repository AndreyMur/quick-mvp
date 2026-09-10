import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { exportPdfSchema } from "@/lib/validations/export";
import { buildReportDocument } from "@/lib/pdf/report";

function contentDisposition(name: string): string {
  const base = name || "project";
  const asciiFallback = base
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(base);
  return `attachment; filename="${asciiFallback}.pdf"; filename*=UTF-8''${encoded}.pdf`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check subscription tier for watermark (server-side, never trust the client).
  // Default to the free tier (watermark on) unless the profile explicitly holds
  // a paid tier, so a missing/unknown tier never silently removes the mark.
  const PAID_TIERS = new Set(["pro", "business"]);
  let isFree = true;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    const tier = (profile as { subscription_tier?: string | null } | null)
      ?.subscription_tier;
    isFree = !tier || !PAID_TIERS.has(tier);
  }

  const body = await request.json();
  const validation = exportPdfSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Неверные данные", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { project, result } = validation.data;

  try {
    const document = buildReportDocument({ project, result, isFree });
    const buffer = await renderToBuffer(document);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(project.name),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации PDF" },
      { status: 500 }
    );
  }
}
