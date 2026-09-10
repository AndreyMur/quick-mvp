"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { signOut, loading } = useAuth();
  const t = useTranslations("auth");

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={signOut}
      disabled={loading}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      {t("signOut")}
    </Button>
  );
}
