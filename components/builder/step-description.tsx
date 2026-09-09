"use client";

import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function StepDescription() {
  const { name, description, setName, setDescription } = useProjectBuilder();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Описание проекта</h2>
        <p className="text-muted-foreground">
          Дайте название вашему проекту и добавьте краткое описание
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">
            Название проекта <span className="text-destructive">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder="Мой новый проект"
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
            Краткое описание
          </Label>
          <Textarea
            id="project-description"
            placeholder="Опишите, что должен делать ваш продукт..."
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
