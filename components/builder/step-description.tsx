"use client";

import { useTranslations } from "next-intl";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function StepDescription() {
  const t = useTranslations("builder.description");
  const { name, description, setName, setDescription } = useProjectBuilder();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">
            {t("nameLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            {name.length}/200
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">
            {t("descriptionLabel")}
          </Label>
          <Textarea
            id="project-description"
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/1000
          </p>
        </div>
      </div>
    </div>
  );
}
