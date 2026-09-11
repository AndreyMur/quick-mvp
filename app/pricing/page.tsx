"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  getCheckoutErrorKey,
  getPlanButtonState,
  getSubscriptionStatusView,
  parseCheckoutOutcome,
} from "@/lib/pricing/view";
import { normalizePlan, type PlanId } from "@/lib/subscription/entitlements";

interface Limits {
  subscription_tier: string;
  project_limit: number;
  projects_used: number;
  can_create_project: boolean;
}

interface SubscriptionStatus {
  subscription_tier: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function PricingContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("pricing");
  const format = useFormatter();

  const [limits, setLimits] = useState<Limits | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const outcome = parseCheckoutOutcome(searchParams.get("checkout"));

  const tiers: {
    name: string;
    key: PlanId;
    price: string;
    description: string;
    features: { text: string; included: boolean }[];
  }[] = [
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
    },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [limitsRes, statusRes] = await Promise.all([
        fetch("/api/user/limits"),
        fetch("/api/subscription/status"),
      ]);

      if (limitsRes.ok) {
        setLimits(await limitsRes.json());
      }
      if (statusRes.ok) {
        setSubscription(await statusRes.json());
      }
    } catch {
      // Ignore — страница остаётся в состоянии free.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (outcome !== "success") return;
    const timer = setTimeout(fetchData, 1500);
    return () => clearTimeout(timer);
  }, [outcome, fetchData]);

  const currentTier: PlanId = normalizePlan(
    subscription?.subscription_tier ??
      limits?.subscription_tier ??
      profile?.subscription_tier
  );

  const statusView = getSubscriptionStatusView(
    subscription?.status,
    subscription?.cancel_at_period_end
  );

  const periodEnd = subscription?.current_period_end
    ? format.dateTime(new Date(subscription.current_period_end), {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const handlePlanClick = async (tier: PlanId) => {
    const state = getPlanButtonState({
      tier,
      currentTier,
      isAuthenticated: Boolean(user),
    });

    if (state.action === "login") {
      router.push("/login");
      return;
    }
    if (state.action !== "checkout") {
      return;
    }

    setCheckoutError(null);
    setPendingPlan(tier);

    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      });

      if (!res.ok) {
        setCheckoutError(getCheckoutErrorKey(res.status));
        if (res.status === 409) {
          fetchData();
        }
        setPendingPlan(null);
        return;
      }

      const data = await res.json();
      if (!data.url) {
        setCheckoutError("error");
        setPendingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError("error");
      setPendingPlan(null);
    }
  };

  const outcomeAlert = checkoutError ? (
    <Alert variant="destructive">
      <XCircle />
      <AlertTitle>{t("checkout.errorTitle")}</AlertTitle>
      <AlertDescription>{t(`checkout.${checkoutError}`)}</AlertDescription>
    </Alert>
  ) : outcome === "success" ? (
    <Alert>
      <CheckCircle2 className="text-green-500" />
      <AlertTitle>{t("checkout.successTitle")}</AlertTitle>
      <AlertDescription>{t("checkout.success")}</AlertDescription>
    </Alert>
  ) : outcome === "cancelled" ? (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{t("checkout.cancelledTitle")}</AlertTitle>
      <AlertDescription>{t("checkout.cancelled")}</AlertDescription>
    </Alert>
  ) : outcome === "error" ? (
    <Alert variant="destructive">
      <XCircle />
      <AlertTitle>{t("checkout.errorTitle")}</AlertTitle>
      <AlertDescription>{t("checkout.error")}</AlertDescription>
    </Alert>
  ) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
          {!loading && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <span>{t("currentPlan")}:</span>
              <Badge variant="secondary" className="capitalize">
                {currentTier}
              </Badge>
              <Badge
                variant={statusView.tone === "warning" ? "destructive" : "outline"}
              >
                {t(`status.${statusView.key}`)}
              </Badge>
              {periodEnd && (
                <span>
                  ·{" "}
                  {subscription?.cancel_at_period_end
                    ? t("cancelsAt", { date: periodEnd })
                    : t("periodEnd", { date: periodEnd })}
                </span>
              )}
              {limits && (
                <span>
                  ·{" "}
                  {t("projectsUsed", {
                    used: limits.projects_used,
                    limit: limits.project_limit,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {outcomeAlert && (
          <div className="max-w-2xl mx-auto mb-8">{outcomeAlert}</div>
        )}

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier) => {
              const state = getPlanButtonState({
                tier: tier.key,
                currentTier,
                isAuthenticated: Boolean(user),
              });
              const isPending = pendingPlan === tier.key;
              const label = isPending
                ? t("cta.processing")
                : state.isCurrent
                  ? t("cta.current")
                  : state.action === "login"
                    ? t("cta.login")
                    : state.action === "checkout"
                      ? t("cta.checkout")
                      : t("cta.unavailable");

              return (
                <Card
                  key={tier.key}
                  className={`relative flex flex-col ${
                    state.isCurrent ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
                  {state.isCurrent && (
                    <Badge className="absolute -top-3 left-4">
                      {t("currentPlan")}
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      {tier.price !== "0" && (
                        <span className="text-muted-foreground ml-1">
                          {t("perMonth")}
                        </span>
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
                          <span
                            className={
                              feature.included ? "" : "text-muted-foreground"
                            }
                          >
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={tier.key === "free" ? "default" : "outline"}
                      disabled={state.disabled || pendingPlan !== null}
                      onClick={() => handlePlanClick(tier.key)}
                    >
                      {isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {label}
                    </Button>
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

function PricingFallback() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingFallback />}>
      <PricingContent />
    </Suspense>
  );
}
