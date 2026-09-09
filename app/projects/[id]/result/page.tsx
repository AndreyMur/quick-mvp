"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Save, FileDown, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { CalculationResult, ProjectData } from "@/lib/types/project";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(262 60% 55%)",
  "hsl(142 71% 45%)",
];

const TECH_LABELS: Record<string, string> = {
  react: "React",
  vue: "Vue",
  angular: "Angular",
  node_js: "Node.js",
  python: "Python",
  ruby: "Ruby",
  php: "PHP",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  react_native: "React Native",
  flutter: "Flutter",
  native_ios: "Native iOS",
  native_android: "Native Android",
};

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { name, description, selectedServices, technology, teamRoles } = useProjectBuilder();
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const calculate = useCallback(async () => {
    try {
      // First try to fetch the project
      const projectRes = await fetch(`/api/projects/${id}`);
      
      if (projectRes.ok) {
        // Existing project — load data from it
        const projectData = await projectRes.json();
        const project = projectData.project;
        if (project?.data?.result) {
          setResult(project.data.result as CalculationResult);
          setSaved(true);
          setLoading(false);
          return;
        }
        // Project exists but no calculation yet — use builder state
      }

      // Calculate from builder state
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: selectedServices,
          technologies: technology,
          team: teamRoles.filter((r) => r.count > 0).map((r) => ({ role: r.role, count: r.count })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Ошибка при расчёте");
        return;
      }

      const data = await res.json();
      setResult(data.result);
    } catch {
      toast.error("Ошибка при расчёте");
    } finally {
      setLoading(false);
    }
  }, [selectedServices, technology, teamRoles, id]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const projectData: ProjectData = {
        name,
        description,
        selectedServices,
        technology,
        teamRoles: teamRoles.filter((r) => r.count > 0),
      };

      // Update existing project or create new
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          status: "completed",
          data: {
            ...projectData,
            result,
          },
        }),
      });

      if (!res.ok) {
        toast.error("Ошибка при сохранении проекта");
        return;
      }

      toast.success("Проект сохранён");
      setSaved(true);
    } catch {
      toast.error("Ошибка при сохранении проекта");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: { name, description },
          result,
          technology,
          teamRoles: teamRoles.filter((r) => r.count > 0),
        }),
      });

      if (!res.ok) {
        toast.error("Ошибка при генерации PDF");
        return;
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "project"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF скачан");
    } catch {
      toast.error("Ошибка при генерации PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Нет данных для отображения</p>
        </div>
      </div>
    );
  }

  const pieData = result.roles.map((r) => ({
    name: r.label,
    value: Math.round(r.cost),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4 max-w-4xl">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-8">
          <Button onClick={handleSave} disabled={saving || saved} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Сохранён" : "Сохранить проект"}
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Экспорт в PDF
          </Button>
          <div className="ml-auto">
            <Badge variant={saved ? "default" : "secondary"}>
              {saved ? "Сохранён" : "Черновик"}
            </Badge>
          </div>
        </div>

        {/* Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">{name}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Стоимость</p>
                <p className="text-2xl font-bold">
                  {Math.round(result.total_cost).toLocaleString("ru-RU")}
                </p>
                <p className="text-xs text-muted-foreground">у.е.</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Человеко-часы</p>
                <p className="text-2xl font-bold">{Math.round(result.total_adjusted_hours)}</p>
                <p className="text-xs text-muted-foreground">
                  (база: {Math.round(result.total_base_hours)})
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Календарное время</p>
                <p className="text-2xl font-bold">{Math.ceil(result.calendar_days)}</p>
                <p className="text-xs text-muted-foreground">дней</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Сервисов</p>
                <p className="text-2xl font-bold">{result.services.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technologies */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Технологии</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Фронтенд: </span>
                <span className="font-medium">{TECH_LABELS[technology.frontend] || technology.frontend}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Бэкенд: </span>
                <span className="font-medium">{TECH_LABELS[technology.backend] || technology.backend}</span>
              </div>
              <div>
                <span className="text-muted-foreground">База данных: </span>
                <span className="font-medium">{TECH_LABELS[technology.database] || technology.database}</span>
              </div>
              {technology.mobile && (
                <div>
                  <span className="text-muted-foreground">Мобильная: </span>
                  <span className="font-medium">{TECH_LABELS[technology.mobile] || technology.mobile}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Services table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Сервисы</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сервис</TableHead>
                  <TableHead className="text-right">Часы</TableHead>
                  <TableHead className="text-right">Стоимость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.services.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell>
                      {s.label}
                      {s.is_custom && <Badge className="ml-2" variant="outline">Кастомный</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{Math.round(s.hours)}</TableCell>
                    <TableCell className="text-right">
                      {s.cost ? `${Math.round(s.cost)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {result.custom_service_fixed_cost > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">Фиксированные стоимости кастомных</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round(result.custom_service_fixed_cost)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Roles table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Роли и стоимость</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">Ставка</TableHead>
                  <TableHead className="text-right">Часы</TableHead>
                  <TableHead className="text-right">Коэфф.</TableHead>
                  <TableHead className="text-right">Стоимость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.roles.map((r) => (
                  <TableRow key={r.role}>
                    <TableCell>
                      {r.label}
                      <span className="text-muted-foreground text-xs ml-1">×{r.count}</span>
                    </TableCell>
                    <TableCell className="text-right">{r.hourly_rate}</TableCell>
                    <TableCell className="text-right">{Math.round(r.adjusted_hours)}</TableCell>
                    <TableCell className="text-right">{r.coefficient.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Math.round(r.cost).toLocaleString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Распределение стоимости по ролям</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) =>
                      typeof value === "number"
                        ? `${Math.round(value).toLocaleString("ru-RU")} у.е.`
                        : String(value)
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Separator className="mb-4" />

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            На дашборд
          </Button>
          <Button onClick={() => router.push(`/projects/${id}/edit`)}>
            Редактировать
          </Button>
        </div>
      </main>
    </div>
  );
}
