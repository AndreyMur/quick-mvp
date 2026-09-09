"use client";

import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const technologies = {
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
    { key: "", label: "Не требуется" },
    { key: "react_native", label: "React Native" },
    { key: "flutter", label: "Flutter" },
    { key: "native_ios", label: "Native iOS" },
    { key: "native_android", label: "Native Android" },
  ],
};

export function StepTechnologies() {
  const { technology, setTechnology } = useProjectBuilder();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Технологии</h2>
        <p className="text-muted-foreground">
          Выберите стек технологий для вашего проекта
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Фронтенд</Label>
          <Select
            value={technology.frontend}
            onValueChange={(v: string | null) => { if (v) setTechnology("frontend", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.frontend.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Бэкенд</Label>
          <Select
            value={technology.backend}
            onValueChange={(v: string | null) => { if (v) setTechnology("backend", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.backend.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>База данных</Label>
          <Select
            value={technology.database}
            onValueChange={(v: string | null) => { if (v) setTechnology("database", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {technologies.database.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Мобильная разработка</Label>
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
              {technologies.mobile.map((t) => (
                <SelectItem key={t.key || "none"} value={t.key || "none"}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
