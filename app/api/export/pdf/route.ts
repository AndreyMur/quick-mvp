import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { exportPdfSchema } from "@/lib/validations/export";
import { buildReportDocument } from "@/lib/pdf/report";
import { getUserEntitlements } from "@/lib/subscription/entitlements";

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

  // Determine the watermark from the server-side subscription (never trust the
  // client). Anonymous callers and users without a paid subscription keep the
  // watermark.
  let isFree = true;
  if (user) {
    const entitlements = await getUserEntitlements(supabase, user.id);
    isFree = entitlements.watermark;
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
