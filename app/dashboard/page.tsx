"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, FolderOpen, Pencil, Trash2, AlertTriangle, Crown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Limits {
  subscription_tier: string;
  project_limit: number;
  custom_services_limit: number;
  projects_used: number;
  can_create_project: boolean;
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const [projects, setProjects] = useState<Project[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projectsRes, limitsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/user/limits"),
      ]);

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects ?? []);
      }

      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setLimits(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(t("toasts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  const handleCreateProject = async () => {
    if (!limits?.can_create_project) {
      setShowLimitModal(true);
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t("newProjectName") }),
      });

      if (!res.ok) {
        toast.error(t("toasts.createError"));
        return;
      }

      const data = await res.json();
      router.push(`/projects/${data.project.id}/edit`);
    } catch {
      toast.error(t("toasts.createError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/projects/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error(t("toasts.deleteError"));
        return;
      }

      toast.success(t("toasts.deleted"));
      setProjects((prev) => prev.filter((p) => p.id !== deleteId));
      if (limits) {
        setLimits({ ...limits, projects_used: limits.projects_used - 1 });
      }
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setDeleteId(null);
    }
  };

  const greeting =
    profile?.full_name || user?.email?.split("@")[0] || t("greetingFallback");

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto py-10 px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-64" />
            <div className="h-4 bg-muted rounded w-48" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {t("greeting", { name: greeting })}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Limits & Actions */}
        {limits && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">{t("limitsTitle")}</CardTitle>
              <CardDescription>
                {t("plan")}:{" "}
                <Badge variant="secondary" className="capitalize">
                  {limits.subscription_tier}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {t("projectsUsed", {
                    used: limits.projects_used,
                    limit: limits.project_limit,
                  })}
                </span>
                <span className="text-sm font-medium">
                  {Math.round((limits.projects_used / limits.project_limit) * 100)}%
                </span>
              </div>
              <Progress
                value={(limits.projects_used / limits.project_limit) * 100}
                className="mb-4"
              />
              <Button
                onClick={handleCreateProject}
                disabled={!limits.can_create_project}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {limits.can_create_project
                  ? t("createProject")
                  : t("limitExhausted")}
              </Button>
              {!limits.can_create_project && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t("limitExhaustedHint")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Projects */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t("projectsTitle")}</h2>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t("noProjects")}</p>
                <Button onClick={handleCreateProject} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("createFirstProject")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card key={project.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base truncate">
                        {project.name}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="group/dropdown-menu-trigger inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {project.status === "completed" && (
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/projects/${project.id}/result`)
                              }
                            >
                              <FolderOpen className="h-4 w-4 mr-2" />
                              {t("actions.openResult")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/projects/${project.id}/edit`)
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            {t("actions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(project.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {commonT("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Badge
                      variant={
                        project.status === "completed" ? "default" : "secondary"
                      }
                    >
                      {project.status === "completed"
                        ? t("status.completed")
                        : t("status.draft")}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      {new Date(project.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t("deleteDialog.title")}
              </DialogTitle>
              <DialogDescription>
                {t("deleteDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                {commonT("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {commonT("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Limit exceeded modal */}
        <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                {t("limitModal.title")}
              </DialogTitle>
              <DialogDescription>
                {limits &&
                  t("limitModal.description", {
                    limit: limits.project_limit,
                  })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLimitModal(false)}>
                {t("limitModal.later")}
              </Button>
              <Link href="/pricing">
                <Button>{t("limitModal.upgrade")}</Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
