"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const serviceLabels: Record<string, string> = {
  authentication: "Аутентификация",
  personal_cabinet: "Личный кабинет",
  payment_system: "Платёжная система",
  chat_basic: "Чат (базовый)",
  admin_panel: "Админ-панель",
  notifications: "Уведомления",
  file_upload: "Загрузка файлов",
  analytics: "Аналитика",
  social_integration: "Интеграция с соцсетями",
  search: "Поиск",
};

const techLabels: Record<string, string> = {
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

export function StepSummary() {
  const {
    name,
    description,
    selectedServices,
    technology,
    teamRoles,
  } = useProjectBuilder();
  const router = useRouter();
  const [calculating, setCalculating] = useState(false);

  const activeRoles = teamRoles.filter((r) => r.count > 0);
  const projectPayload = {
    name,
    description,
    selectedServices,
    technology,
    teamRoles: activeRoles,
  };

  const saveProjectDraft = async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        status: "draft",
        data: projectPayload,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Ошибка при сохранении проекта");
    }
  };

  const ensureProjectId = async () => {
    const currentPath = window.location.pathname;
    const match = currentPath.match(/\/projects\/([^/]+)\/edit/);

    if (match) {
      const projectId = match[1];
      await saveProjectDraft(projectId);
      return projectId;
    }

    const createRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error || "Ошибка при создании проекта");
    }

    const created = await createRes.json();
    const projectId = created.project?.id as string | undefined;

    if (!projectId) {
      throw new Error("Не удалось получить ID проекта");
    }

    await saveProjectDraft(projectId);
    return projectId;
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: selectedServices,
          technologies: technology,
          team: activeRoles.map((r) => ({ role: r.role, count: r.count })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Ошибка при расчёте");
        return;
      }

      const projectId = await ensureProjectId();
      toast.success("Расчёт выполнен! Переход на страницу результата...");
      router.push(`/projects/${projectId}/result`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка при расчёте"
      );
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Саммари и расчёт</h2>
        <p className="text-muted-foreground">
          Проверьте параметры проекта и нажмите «Рассчитать»
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{name}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сервисы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((key) => (
              <Badge key={key} variant="secondary">
                {serviceLabels[key] || key}
              </Badge>
            ))}
          </div>
          {selectedServices.length === 0 && (
            <p className="text-sm text-muted-foreground">Не выбрано</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Технологии</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Фронтенд: </span>
              <span>{techLabels[technology.frontend] || technology.frontend}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Бэкенд: </span>
              <span>{techLabels[technology.backend] || technology.backend}</span>
            </div>
            <div>
              <span className="text-muted-foreground">База данных: </span>
              <span>{techLabels[technology.database] || technology.database}</span>
            </div>
            {technology.mobile && (
              <div>
                <span className="text-muted-foreground">Мобильная: </span>
                <span>{techLabels[technology.mobile] || technology.mobile}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Команда</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeRoles.map((role) => (
              <div
                key={role.role}
                className="flex items-center justify-between text-sm"
              >
                <span>{role.label}</span>
                <Badge>{role.count}</Badge>
              </div>
            ))}
            {activeRoles.length === 0 && (
              <p className="text-sm text-muted-foreground">Не выбрано</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button
        onClick={handleCalculate}
        disabled={calculating || activeRoles.length === 0}
        className="w-full"
        size="lg"
      >
        {calculating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Рассчитываем...
          </>
        ) : (
          "Рассчитать"
        )}
      </Button>
    </div>
  );
}
