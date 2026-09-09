import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check subscription tier for watermark
  let isFree = true;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    const p = profile as { subscription_tier?: string } | null;
    isFree = p?.subscription_tier === "free";
  }

  const body = await request.json();
  const { project, result, technology, teamRoles } = body;

  // For MVP, we'll generate a simple HTML response that can be printed as PDF
  // Full @react-pdf/renderer implementation would be in a separate file
  const html = generatePdfHtml(project, result, technology, teamRoles, isFree);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project?.name || "project"}.pdf"`,
    },
  });
}

function generatePdfHtml(
  project: { name: string; description?: string },
  result: {
    total_base_hours: number;
    total_adjusted_hours: number;
    total_cost: number;
    calendar_days: number;
    roles: Array<{
      role: string;
      label: string;
      hourly_rate: number;
      base_hours: number;
      coefficient: number;
      adjusted_hours: number;
      cost: number;
      count: number;
    }>;
    services: Array<{
      key: string;
      label: string;
      hours: number;
      cost: number | null;
      is_custom: boolean;
    }>;
    custom_service_fixed_cost: number;
  },
  _technology: Record<string, string>,
  _teamRoles: Array<{ role: string; label: string; count: number }>,
  isFree: boolean
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${project.name || "Project"} - MVP Calculator</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 20px; font-weight: bold; }
    .date { font-size: 12px; color: #666; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-item { background: #f5f5f5; padding: 12px; border-radius: 8px; }
    .summary-label { font-size: 12px; color: #666; }
    .summary-value { font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; }
    td { font-size: 14px; }
    .text-right { text-align: right; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; display: flex; justify-content: space-between; }
    .watermark { position: fixed; bottom: 20px; right: 20px; font-size: 14px; color: rgba(0,0,0,0.1); transform: rotate(-30deg); pointer-events: none; }
    h2 { font-size: 18px; margin-bottom: 12px; }
  </style>
</head>
<body>
  ${isFree ? '<div class="watermark">MVP Calculator Demo</div>' : ""}

  <div class="header">
    <div class="logo">MVP Calculator</div>
    <div class="date">${new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</div>
  </div>

  <h1>${project.name || "Проект"}</h1>
  ${project.description ? `<p style="color: #666; margin-bottom: 24px;">${project.description}</p>` : ""}

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Стоимость</div>
      <div class="summary-value">${Math.round(result.total_cost).toLocaleString("ru-RU")} у.е.</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Человеко-часы</div>
      <div class="summary-value">${Math.round(result.total_adjusted_hours)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Календарное время</div>
      <div class="summary-value">${Math.ceil(result.calendar_days)} дней</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Сервисов</div>
      <div class="summary-value">${result.services.length}</div>
    </div>
  </div>

  <h2>Сервисы</h2>
  <table>
    <thead>
      <tr><th>Сервис</th><th class="text-right">Часы</th><th class="text-right">Стоимость</th></tr>
    </thead>
    <tbody>
      ${result.services
        .map(
          (s) =>
            `<tr><td>${s.label}${s.is_custom ? " (Кастомный)" : ""}</td><td class="text-right">${Math.round(s.hours)}</td><td class="text-right">${s.cost ? Math.round(s.cost) : "—"}</td></tr>`
        )
        .join("")}
      ${result.custom_service_fixed_cost > 0 ? `<tr><td><strong>Фиксированные стоимости кастомных</strong></td><td class="text-right">—</td><td class="text-right"><strong>${Math.round(result.custom_service_fixed_cost)}</strong></td></tr>` : ""}
    </tbody>
  </table>

  <h2>Роли и стоимость</h2>
  <table>
    <thead>
      <tr><th>Роль</th><th class="text-right">Ставка</th><th class="text-right">Часы</th><th class="text-right">Коэфф.</th><th class="text-right">Стоимость</th></tr>
    </thead>
    <tbody>
      ${result.roles
        .map(
          (r) =>
            `<tr><td>${r.label} (×${r.count})</td><td class="text-right">${r.hourly_rate}</td><td class="text-right">${Math.round(r.adjusted_hours)}</td><td class="text-right">${r.coefficient.toFixed(2)}</td><td class="text-right"><strong>${Math.round(r.cost).toLocaleString("ru-RU")}</strong></td></tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    <div>Сгенерировано в MVP Calculator</div>
    ${isFree ? '<div style="color: #999;">Бесплатный тариф — водяной знак применён</div>' : ""}
  </div>

  <script>window.print();</script>
</body>
</html>`;
}
