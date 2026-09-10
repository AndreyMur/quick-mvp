"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  UserCircle,
  CreditCard,
  MessageSquare,
  Shield,
  Bell,
  Upload,
  BarChart3,
  Share2,
  Search,
  Plus,
} from "lucide-react";

const standardServices = [
  { key: "authentication", icon: KeyRound },
  { key: "personal_cabinet", icon: UserCircle },
  { key: "payment_system", icon: CreditCard },
  { key: "chat_basic", icon: MessageSquare },
  { key: "admin_panel", icon: Shield },
  { key: "notifications", icon: Bell },
  { key: "file_upload", icon: Upload },
  { key: "analytics", icon: BarChart3 },
  { key: "social_integration", icon: Share2 },
  { key: "search", icon: Search },
];

interface CustomService {
  id: string;
  name: string;
  icon_url: string | null;
}

export function StepServices() {
  const t = useTranslations("builder.services");
  const { selectedServices, toggleService } = useProjectBuilder();
  const [customServices, setCustomServices] = useState<CustomService[]>([]);

  useEffect(() => {
    fetch("/api/custom-services")
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => setCustomServices(data.services ?? []))
      .catch(() => setCustomServices([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          {t("standard")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {standardServices.map(({ key, icon: Icon }) => {
            const isSelected = selectedServices.includes(key);
            return (
              <Card
                key={key}
                className={cn(
                  "flex flex-col items-center justify-center p-4 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                  isSelected
                    ? "bg-primary text-primary-foreground ring-2 ring-primary"
                    : "bg-background"
                )}
                onClick={() => toggleService(key)}
              >
                <Icon
                  className={cn(
                    "h-8 w-8 mb-2",
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-xs text-center",
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {t(`items.${key}`)}
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      {customServices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t("custom")}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {customServices.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <Card
                  key={service.id}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary"
                      : "bg-background"
                  )}
                  onClick={() => toggleService(service.id)}
                >
                  {service.icon_url ? (
                    <img
                      src={service.icon_url}
                      alt={service.name}
                      className="h-8 w-8 mb-2 object-contain"
                    />
                  ) : (
                    <Plus
                      className={cn(
                        "h-8 w-8 mb-2",
                        isSelected
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "text-xs text-center",
                      isSelected
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {service.name}
                  </span>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {t("selectedCount", { count: selectedServices.length })}
      </div>
    </div>
  );
}
