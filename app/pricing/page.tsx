"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";

interface Limits {
  subscription_tier: string;
  project_limit: number;
  projects_used: number;
  can_create_project: boolean;
}

export default function PricingPage() {
  const { profile } = useAuth();
  const t = useTranslations("pricing");
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);

  const tiers = [
    {
      name: t("tiers.free.name"),
      key: "free",
      price: "0",
      description: t("tiers.free.description"),
      features: [
        { text: t("tiers.free.features.projects"), included: true },
        { text: t("tiers.free.features.customServices"), included: true },
        { text: t("tiers.free.features.baseFeatures"), included: true },
        { text: t("tiers.free.features.pdfExport"), included: true },
        { text: t("tiers.free.features.watermark"), included: false },
      ],
      cta: t("tiers.free.cta"),
      ctaActive: true,
    },
    {
      name: t("tiers.pro.name"),
      key: "pro",
      price: "99",
      description: t("tiers.pro.description"),
      features: [
        { text: t("tiers.pro.features.projects"), included: true },
        { text: t("tiers.pro.features.customServices"), included: true },
        { text: t("tiers.pro.features.noWatermark"), included: true },
        { text: t("tiers.pro.features.prioritySupport"), included: true },
        { text: t("tiers.pro.features.teamAccess"), included: false },
      ],
      cta: t("tiers.pro.cta"),
      ctaActive: false,
    },
    {
      name: t("tiers.business.name"),
      key: "business",
      price: "299",
      description: t("tiers.business.description"),
      features: [
        { text: t("tiers.business.features.projects"), included: true },
        { text: t("tiers.business.features.customServices"), included: true },
        { text: t("tiers.business.features.noWatermark"), included: true },
        { text: t("tiers.business.features.teamAccess"), included: true },
        { text: t("tiers.business.features.apiAccess"), included: true },
      ],
      cta: t("tiers.business.cta"),
      ctaActive: false,
    },
  ];

  const fetchLimits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/limits");
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
          {limits && (
            <p className="text-sm text-muted-foreground mt-4">
              {t("currentPlan")}: <Badge variant="secondary" className="capitalize">{limits.subscription_tier}</Badge>
              {" "}·{" "}
              {t("projectsUsed", {
                used: limits.projects_used,
                limit: limits.project_limit,
              })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier) => {
              const isCurrent = profile?.subscription_tier === tier.key;

              return (
                <Card
                  key={tier.key}
                  className={`relative flex flex-col ${
                    isCurrent ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-4">{t("currentPlan")}</Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      {tier.price !== "0" && (
                        <span className="text-muted-foreground ml-1">{t("perMonth")}</span>
                      )}
                    </div>
                    <ul className="space-y-3">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          {feature.included ? (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={feature.included ? "" : "text-muted-foreground"}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {tier.ctaActive && isCurrent ? (
                      <Button className="w-full" disabled>
                        {tier.cta}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={tier.key === "free" ? "default" : "outline"}
                        disabled
                      >
                        {tier.cta}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
