"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, DollarSign, Clock, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserRate { role: string; hourly_rate: number }
interface UserServiceHour { service_key: string; hours: number; fixed_cost: number | null }
interface CustomService {
  id: string;
  name: string;
  hours: number;
  fixed_cost: number | null;
  icon_url: string | null;
}
interface TechCoeff { technology_key: string; coefficient: number }

export default function SettingsPage() {
  const { profile } = useAuth();
  const t = useTranslations("settings");
  const format = useFormatter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile tab
  const [fullName, setFullName] = useState("");

  // Rates tab
  const [userRates, setUserRates] = useState<UserRate[]>([]);
  const [globalRates, setGlobalRates] = useState<{ role: string; hourly_rate: number }[]>([]);

  // Service hours tab
  const [userServiceHours, setUserServiceHours] = useState<UserServiceHour[]>([]);
  const [globalHours, setGlobalHours] = useState<{ service_key: string; hours: number }[]>([]);

  // Custom services tab
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [editingService, setEditingService] = useState<CustomService | null>(null);
  const [newService, setNewService] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Coefficients tab
  const [techCoeffs, setTechCoeffs] = useState<TechCoeff[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, coeffsRes] = await Promise.all([
        fetch("/api/settings/user"),
        fetch("/api/technologies/coefficients"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setUserRates(data.user_rates ?? []);
        setUserServiceHours(data.user_service_hours ?? []);
        setCustomServices(data.custom_services ?? []);
      }

      // Fetch global rates for reference
      const globalRes = await fetch("/api/admin/settings/global");
      if (globalRes.ok) {
        const data = await globalRes.json();
        setGlobalRates(data.global_rates ?? []);
        setGlobalHours(data.global_service_hours ?? []);
      }

      if (coeffsRes.ok) {
        const data = await coeffsRes.json();
        setTechCoeffs(data.coefficients ?? []);
      }
    } catch {
      toast.error(t("toasts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  // Save profile
  const handleSaveProfile = async () => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) {
        toast.error(t("toasts.saveError"));
        return;
      }
      toast.success(t("toasts.profileSaved"));
    } catch {
      toast.error(t("toasts.saveError"));
    }
  };

  // Save rates & service hours
  const handleSaveRates = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_rates: userRates,
          user_service_hours: userServiceHours,
        }),
      });
      if (!res.ok) {
        toast.error(t("toasts.saveError"));
        return;
      }
      toast.success(t("toasts.settingsSaved"));
    } catch {
      toast.error(t("toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Save custom service
  const handleSaveService = async (service: { name: string; hours: number; fixed_cost: number | null; icon_url?: string | null }) => {
    try {
      const url = editingService
        ? `/api/custom-services?id=${editingService.id}`
        : "/api/custom-services";
      const method = editingService ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("toasts.saveError"));
        return;
      }

      toast.success(
        editingService ? t("toasts.serviceUpdated") : t("toasts.serviceCreated")
      );
      setEditingService(null);
      setNewService(false);
      fetchData();
    } catch {
      toast.error(t("toasts.saveError"));
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      const res = await fetch(`/api/custom-services?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("toasts.deleteError"));
        return;
      }
      toast.success(t("toasts.serviceDeleted"));
      fetchData();
    } catch {
      toast.error(t("toasts.deleteError"));
    }
  };

  const handleUploadIcon = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/custom-services/upload-icon", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        toast.error(t("toasts.iconUploadError"));
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch {
      toast.error(t("toasts.iconUploadError"));
      return null;
    } finally {
      setUploading(false);
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

        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              {t("tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="rates" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t("tabs.rates")}
            </TabsTrigger>
            <TabsTrigger value="service-hours" className="gap-2">
              <Clock className="h-4 w-4" />
              {t("tabs.serviceHours")}
            </TabsTrigger>
            <TabsTrigger value="custom-services" className="gap-2">
              <Plus className="h-4 w-4" />
              {t("tabs.customServices")}
            </TabsTrigger>
            <TabsTrigger value="coefficients" className="gap-2">
              <Clock className="h-4 w-4" />
              {t("tabs.coefficients")}
            </TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{t("profile.title")}</CardTitle>
                <CardDescription>{t("profile.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("profile.email")}</Label>
                  <Input value={profile?.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{t("profile.displayName")}</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("profile.namePlaceholder")}
                  />
                </div>
                <Button onClick={handleSaveProfile}>{t("profile.save")}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rates */}
          <TabsContent value="rates">
            <Card>
              <CardHeader>
                <CardTitle>{t("rates.title")}</CardTitle>
                <CardDescription>{t("rates.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("rates.role")}</TableHead>
                      <TableHead className="text-right">{t("rates.globalRate")}</TableHead>
                      <TableHead className="text-right">{t("rates.yourRate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalRates.map((gr) => {
                      const userRate = userRates.find((ur) => ur.role === gr.role);
                      return (
                        <TableRow key={gr.role}>
                          <TableCell className="capitalize">
                            {gr.role.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {gr.hourly_rate}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={userRate?.hourly_rate ?? ""}
                              placeholder={String(gr.hourly_rate)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUserRates((prev) => {
                                  const exists = prev.find((ur) => ur.role === gr.role);
                                  if (val === "") {
                                    return prev.filter((ur) => ur.role !== gr.role);
                                  }
                                  if (exists) {
                                    return prev.map((ur) =>
                                      ur.role === gr.role
                                        ? { ...ur, hourly_rate: parseInt(val) || 0 }
                                        : ur
                                    );
                                  }
                                  return [...prev, { role: gr.role, hourly_rate: parseInt(val) || 0 }];
                                });
                              }}
                              className="w-24 ml-auto"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Button onClick={handleSaveRates} className="mt-4" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("rates.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Hours */}
          <TabsContent value="service-hours">
            <Card>
              <CardHeader>
                <CardTitle>{t("serviceHours.title")}</CardTitle>
                <CardDescription>{t("serviceHours.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("serviceHours.service")}</TableHead>
                      <TableHead className="text-right">{t("serviceHours.globalHours")}</TableHead>
                      <TableHead className="text-right">{t("serviceHours.yourHours")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalHours.map((gh) => {
                      const userHour = userServiceHours.find((uh) => uh.service_key === gh.service_key);
                      return (
                        <TableRow key={gh.service_key}>
                          <TableCell className="capitalize">
                            {gh.service_key.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {gh.hours}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={userHour?.hours ?? ""}
                              placeholder={String(gh.hours)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUserServiceHours((prev) => {
                                  const exists = prev.find((uh) => uh.service_key === gh.service_key);
                                  if (val === "") {
                                    return prev.filter((uh) => uh.service_key !== gh.service_key);
                                  }
                                  if (exists) {
                                    return prev.map((uh) =>
                                      uh.service_key === gh.service_key
                                        ? { ...uh, hours: parseInt(val) || 0 }
                                        : uh
                                    );
                                  }
                                  return [...prev, { service_key: gh.service_key, hours: parseInt(val) || 0, fixed_cost: null }];
                                });
                              }}
                              className="w-24 ml-auto"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Button onClick={handleSaveRates} className="mt-4" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("serviceHours.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Services */}
          <TabsContent value="custom-services">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t("customServices.title")}</span>
                  <Button onClick={() => setNewService(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("customServices.add")}
                  </Button>
                </CardTitle>
                <CardDescription>
                  {t("customServices.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customServices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {t("customServices.empty")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("customServices.icon")}</TableHead>
                        <TableHead>{t("customServices.name")}</TableHead>
                        <TableHead className="text-right">{t("customServices.hours")}</TableHead>
                        <TableHead className="text-right">{t("customServices.fixedCost")}</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customServices.map((cs) => (
                        <TableRow key={cs.id}>
                          <TableCell>
                            {cs.icon_url ? (
                              <img
                                src={cs.icon_url}
                                alt={cs.name}
                                className="h-8 w-8 object-contain"
                              />
                            ) : (
                              <Badge variant="outline">{t("customServices.no")}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{cs.name}</TableCell>
                          <TableCell className="text-right">{cs.hours}</TableCell>
                          <TableCell className="text-right">
                            {cs.fixed_cost ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingService(cs)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteService(cs.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coefficients */}
          <TabsContent value="coefficients">
            <Card>
              <CardHeader>
                <CardTitle>{t("coefficients.title")}</CardTitle>
                <CardDescription>
                  {t("coefficients.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("coefficients.technology")}</TableHead>
                      <TableHead className="text-right">{t("coefficients.coefficient")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {techCoeffs.map((tc) => (
                      <TableRow key={tc.technology_key}>
                        <TableCell className="capitalize">
                          {tc.technology_key.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge>
                            {format.number(tc.coefficient, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Custom Service Dialog */}
        {(newService || editingService) && (
          <CustomServiceDialog
            service={editingService}
            onSave={handleSaveService}
            onUploadIcon={handleUploadIcon}
            uploading={uploading}
            onClose={() => {
              setNewService(false);
              setEditingService(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

function CustomServiceDialog({
  service,
  onSave,
  onUploadIcon,
  uploading,
  onClose,
}: {
  service: CustomService | null;
  onSave: (data: { name: string; hours: number; fixed_cost: number | null; icon_url?: string | null }) => void;
  onUploadIcon: (file: File) => Promise<string | null>;
  uploading: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.dialog");
  const [name, setName] = useState(service?.name ?? "");
  const [hours, setHours] = useState(String(service?.hours ?? 0));
  const [fixedCost, setFixedCost] = useState(service?.fixed_cost != null ? String(service.fixed_cost) : "");
  const [iconUrl, setIconUrl] = useState<string | null>(service?.icon_url ?? null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await onUploadIcon(file);
    if (url) setIconUrl(url);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {service ? t("editTitle") : t("newTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("hours")}</Label>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("fixedCost")}</Label>
            <Input
              type="number"
              value={fixedCost}
              onChange={(e) => setFixedCost(e.target.value)}
              placeholder={t("fixedCostPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("icon")}</Label>
            <div className="flex items-center gap-3">
              {iconUrl && (
                <img src={iconUrl} alt="icon" className="h-10 w-10 object-contain border rounded" />
              )}
              <Input
                type="file"
                accept=".png,.svg,image/png,image/svg+xml"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() =>
              onSave({
                name,
                hours: parseInt(hours) || 0,
                fixed_cost: fixedCost ? parseInt(fixedCost) : null,
                icon_url: iconUrl,
              })
            }
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
