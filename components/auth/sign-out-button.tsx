"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { signOut, loading } = useAuth();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={signOut}
      disabled={loading}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      Выйти
    </Button>
  );
}
