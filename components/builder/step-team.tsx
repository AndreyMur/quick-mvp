"use client";

import { useTranslations } from "next-intl";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";

export function StepTeam() {
  const t = useTranslations("builder.team");
  const { teamRoles, setTeamRoleCount } = useProjectBuilder();

  const activeRoles = teamRoles.filter((r) => r.count > 0);
  const totalPeople = activeRoles.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {totalPeople > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {t("totalPeople")} <strong>{totalPeople}</strong>
          </span>
        </div>
      )}

      <div className="space-y-3">
        {teamRoles.map((role) => {
          const isActive = role.count > 0;
          return (
            <div
              key={role.role}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                isActive
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <Label className="flex-1 cursor-pointer font-medium">
                {role.label}
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{t("count")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={role.count}
                    onChange={(e) =>
                      setTeamRoleCount(
                        role.role,
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                    className="w-16 h-8"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground">
        {t("summary", { roles: activeRoles.length, people: totalPeople })}
      </div>
    </div>
  );
}
