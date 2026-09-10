"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical, Edit2, Trash2, AlertTriangle, Loader2, Settings2, Users } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  subscription_tier: string;
  project_limit: number;
  custom_services_limit: number;
  created_at: string;
  project_count: number;
}

interface GlobalRate { role: string; hourly_rate: number }
interface GlobalServiceHour { service_key: string; hours: number; fixed_cost: number | null }
interface TechCoeff { technology_key: string; coefficient: number }

export default function AdminPage() {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Global settings
  const [globalRates, setGlobalRates] = useState<GlobalRate[]>([]);
  const [globalHours, setGlobalHours] = useState<GlobalServiceHour[]>([]);
  const [techCoeffs, setTechCoeffs] = useState<TechCoeff[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        if (res.status === 403) {
          toast.error(t("toasts.accessDenied"));
          return;
        }
        toast.error(t("toasts.loadUsersError"));
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error(t("toasts.loadUsersError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/global");
      if (!res.ok) {
        toast.error(t("toasts.loadSettingsError"));
        return;
      }
      const data = await res.json();
      setGlobalRates(data.global_rates ?? []);
      setGlobalHours(data.global_service_hours ?? []);
      setTechCoeffs(data.technology_coefficients ?? []);
    } catch {
      toast.error(t("toasts.loadSettingsError"));
    } finally {
      setSettingsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, [fetchUsers, fetchSettings]);

  const handleSaveUser = async () => {
    if (!editUser) return;
    try {
      const res = await fetch(`/api/admin/users?id=${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_limit: editUser.project_limit,
          is_admin: editUser.is_admin,
          subscription_tier: editUser.subscription_tier,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("toasts.saveError"));
        return;
      }
      toast.success(t("toasts.userUpdated"));
      setEditUser(null);
      fetchUsers();
    } catch {
      toast.error(t("toasts.saveError"));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      const res = await fetch(`/api/admin/users?id=${deleteUserId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error(t("toasts.deleteError"));
        return;
      }

      toast.success(t("toasts.userDeleted"));
      setDeleteUserId(null);
      fetchUsers();
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setDeleteUserId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings/global", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          global_rates: globalRates,
          global_service_hours: globalHours,
          technology_coefficients: techCoeffs,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("toasts.saveError"));
        return;
      }
      toast.success(t("toasts.settingsSaved"));
    } catch {
      toast.error(t("toasts.saveError"));
    } finally {
      setSavingSettings(false);
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              {t("tabs.users")}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              {t("tabs.settings")}
            </TabsTrigger>
          </TabsList>

          {/* Users tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>{t("users.title")}</CardTitle>
                <CardDescription>
                  {t("users.total", { count: users.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("users.email")}</TableHead>
                      <TableHead>{t("users.name")}</TableHead>
                      <TableHead>{t("users.tier")}</TableHead>
                      <TableHead>{t("users.projectLimit")}</TableHead>
                      <TableHead>{t("users.projects")}</TableHead>
                      <TableHead>{t("users.createdAt")}</TableHead>
                      <TableHead>{t("users.isAdmin")}</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.full_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {u.subscription_tier}
                          </Badge>
                        </TableCell>
                        <TableCell>{u.project_limit}</TableCell>
                        <TableCell>{u.project_count}</TableCell>
                        <TableCell>
                          {new Date(u.created_at).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          {u.is_admin ? (
                            <Badge>{t("users.adminBadge")}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="group/dropdown-menu-trigger inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditUser(u)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                {t("users.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteUserId(u.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("users.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings">
            {settingsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Global Rates */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings.ratesTitle")}</CardTitle>
                    <CardDescription>{t("settings.ratesDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("settings.role")}</TableHead>
                          <TableHead className="text-right w-40">{t("settings.rate")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globalRates.map((rate) => (
                          <TableRow key={rate.role}>
                            <TableCell className="capitalize">
                              {rate.role.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={rate.hourly_rate}
                                onChange={(e) =>
                                  setGlobalRates((prev) =>
                                    prev.map((r) =>
                                      r.role === rate.role
                                        ? { ...r, hourly_rate: parseInt(e.target.value) || 0 }
                                        : r
                                    )
                                  )
                                }
                                className="text-right"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Service Hours */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings.hoursTitle")}</CardTitle>
                    <CardDescription>{t("settings.hoursDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("settings.service")}</TableHead>
                          <TableHead className="text-right w-40">{t("settings.hours")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globalHours.map((s) => (
                          <TableRow key={s.service_key}>
                            <TableCell className="capitalize">
                              {s.service_key.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={s.hours}
                                onChange={(e) =>
                                  setGlobalHours((prev) =>
                                    prev.map((h) =>
                                      h.service_key === s.service_key
                                        ? { ...h, hours: parseInt(e.target.value) || 0 }
                                        : h
                                    )
                                  )
                                }
                                className="text-right"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Technology Coefficients */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings.coeffsTitle")}</CardTitle>
                    <CardDescription>{t("settings.coeffsDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("settings.technology")}</TableHead>
                          <TableHead className="text-right w-40">{t("settings.coefficient")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {techCoeffs.map((c) => (
                          <TableRow key={c.technology_key}>
                            <TableCell className="capitalize">
                              {c.technology_key.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={c.coefficient}
                                onChange={(e) =>
                                  setTechCoeffs((prev) =>
                                    prev.map((t) =>
                                      t.technology_key === c.technology_key
                                        ? { ...t, coefficient: parseFloat(e.target.value) || 1.0 }
                                        : t
                                    )
                                  )
                                }
                                className="text-right"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("settings.saving")}
                    </>
                  ) : (
                    t("settings.save")
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit user dialog */}
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editDialog.title")}</DialogTitle>
              <DialogDescription>{editUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("editDialog.projectLimit")}</Label>
                <Input
                  type="number"
                  value={editUser?.project_limit ?? 3}
                  onChange={(e) =>
                    setEditUser((prev) =>
                      prev ? { ...prev, project_limit: parseInt(e.target.value) || 3 } : null
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("editDialog.tier")}</Label>
                <Select
                  value={editUser?.subscription_tier ?? "free"}
                  onValueChange={(v: string | null) => {
                    if (v) setEditUser((prev) => (prev ? { ...prev, subscription_tier: v } : null));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">{t("editDialog.tierFree")}</SelectItem>
                    <SelectItem value="pro">{t("editDialog.tierPro")}</SelectItem>
                    <SelectItem value="business">{t("editDialog.tierBusiness")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-admin"
                  checked={editUser?.is_admin ?? false}
                  onChange={(e) =>
                    setEditUser((prev) => (prev ? { ...prev, is_admin: e.target.checked } : null))
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="is-admin" className="cursor-pointer">
                  {t("editDialog.isAdmin")}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>
                {t("editDialog.cancel")}
              </Button>
              <Button onClick={handleSaveUser}>{t("editDialog.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
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
              <Button variant="outline" onClick={() => setDeleteUserId(null)}>
                {t("deleteDialog.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                {t("deleteDialog.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
