"use client";

import { useEffect, useState, useCallback } from "react";
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
          toast.error("Доступ запрещён");
          return;
        }
        toast.error("Ошибка при загрузке пользователей");
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error("Ошибка при загрузке пользователей");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/global");
      if (!res.ok) {
        toast.error("Ошибка при загрузке настроек");
        return;
      }
      const data = await res.json();
      setGlobalRates(data.global_rates ?? []);
      setGlobalHours(data.global_service_hours ?? []);
      setTechCoeffs(data.technology_coefficients ?? []);
    } catch {
      toast.error("Ошибка при загрузке настроек");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

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
        toast.error(err.error || "Ошибка при сохранении");
        return;
      }
      toast.success("Пользователь обновлён");
      setEditUser(null);
      fetchUsers();
    } catch {
      toast.error("Ошибка при сохранении");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      const res = await fetch(`/api/admin/users?id=${deleteUserId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Ошибка при удалении");
        return;
      }

      toast.success("Пользователь удалён");
      setDeleteUserId(null);
      fetchUsers();
    } catch {
      toast.error("Ошибка при удалении");
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
        toast.error(err.error || "Ошибка при сохранении");
        return;
      }
      toast.success("Настройки сохранены");
    } catch {
      toast.error("Ошибка при сохранении");
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
        <h1 className="text-3xl font-bold mb-6">Админ-панель</h1>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Глобальные настройки
            </TabsTrigger>
          </TabsList>

          {/* Users tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Управление пользователями</CardTitle>
                <CardDescription>
                  Всего пользователей: {users.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Тариф</TableHead>
                      <TableHead>Лимит проектов</TableHead>
                      <TableHead>Проектов</TableHead>
                      <TableHead>Дата регистрации</TableHead>
                      <TableHead>Админ</TableHead>
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
                            <Badge>Админ</Badge>
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
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteUserId(u.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Удалить
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
                    <CardTitle>Ставки команды</CardTitle>
                    <CardDescription>Часовая ставка для каждой роли (у.е.)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Роль</TableHead>
                          <TableHead className="text-right w-40">Ставка</TableHead>
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
                    <CardTitle>Нормативы времени на сервисы</CardTitle>
                    <CardDescription>Человеко-часы для каждого сервиса</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Сервис</TableHead>
                          <TableHead className="text-right w-40">Часы</TableHead>
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
                    <CardTitle>Коэффициенты технологий</CardTitle>
                    <CardDescription>Коэффициент сложности (по умолчанию 1.0)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Технология</TableHead>
                          <TableHead className="text-right w-40">Коэффициент</TableHead>
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
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить настройки"
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
              <DialogTitle>Редактировать пользователя</DialogTitle>
              <DialogDescription>{editUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Лимит проектов</Label>
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
                <Label>Тариф</Label>
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
                    <SelectItem value="free">Бесплатный</SelectItem>
                    <SelectItem value="pro">Профессиональный</SelectItem>
                    <SelectItem value="business">Бизнес</SelectItem>
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
                  Администратор
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveUser}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Удалить пользователя?
              </DialogTitle>
              <DialogDescription>
                Это действие удалит пользователя и все его проекты. Отменить невозможно.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserId(null)}>
                Отмена
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                Удалить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
