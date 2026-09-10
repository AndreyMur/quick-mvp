"use client";

import { useTranslations } from "next-intl";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const technologies: Record<string, { key: string; label?: string }[]> = {
  frontend: [
    { key: "react", label: "React" },
    { key: "vue", label: "Vue" },
    { key: "angular", label: "Angular" },
  ],
  backend: [
    { key: "node_js", label: "Node.js" },
    { key: "python", label: "Python" },
    { key: "ruby", label: "Ruby" },
    { key: "php", label: "PHP" },
  ],
  database: [
    { key: "postgresql", label: "PostgreSQL" },
    { key: "mysql", label: "MySQL" },
    { key: "mongodb", label: "MongoDB" },
  ],
  mobile: [
    { key: "" },
    { key: "react_native", label: "React Native" },
    { key: "flutter", label: "Flutter" },
    { key: "native_ios", label: "Native iOS" },
    { key: "native_android", label: "Native Android" },
  ],
};

export function StepTechnologies() {
  const t = useTranslations("builder.technologies");
  const { technology, setTechnology } = useProjectBuilder();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>{t("frontend")}</Label>
          <Select
            value={technology.frontend}
            onValueChange={(v: string | null) => { if (v) setTechnology("frontend", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.frontend.map((tech) => (
                <SelectItem key={tech.key} value={tech.key}>
                  {tech.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("backend")}</Label>
          <Select
            value={technology.backend}
            onValueChange={(v: string | null) => { if (v) setTechnology("backend", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.backend.map((tech) => (
                <SelectItem key={tech.key} value={tech.key}>
                  {tech.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("database")}</Label>
          <Select
            value={technology.database}
            onValueChange={(v: string | null) => { if (v) setTechnology("database", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.database.map((tech) => (
                <SelectItem key={tech.key} value={tech.key}>
                  {tech.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("mobile")}</Label>
          <Select
            value={technology.mobile || "none"}
            onValueChange={(v: string | null) => {
              if (v && v !== "none") setTechnology("mobile", v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.mobile.map((tech) => (
                <SelectItem key={tech.key || "none"} value={tech.key || "none"}>
                  {tech.label ?? t("none")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
