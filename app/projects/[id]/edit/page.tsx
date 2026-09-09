"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import type { ProjectBuilderState } from "@/lib/stores/project-builder";
import { WizardLayout } from "@/components/builder/wizard-layout";
import { StepDescription } from "@/components/builder/step-description";
import { StepServices } from "@/components/builder/step-services";
import { StepTechnologies } from "@/components/builder/step-technologies";
import { StepTeam } from "@/components/builder/step-team";
import { StepSummary } from "@/components/builder/step-summary";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  data: Record<string, unknown>;
}

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentStep, hydrate } = useProjectBuilder();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) {
          toast.error("Проект не найден");
          router.push("/dashboard");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const project = data.project as ProjectData;
        const builderData = project.data as Record<string, unknown> | undefined;
        if (builderData) {
          hydrate({
            name: project.name,
            description: project.description || "",
            selectedServices: (builderData.selectedServices as string[]) || [],
            technology: {
              frontend: String((builderData.technology as Record<string, string>)?.frontend || "react"),
              backend: String((builderData.technology as Record<string, string>)?.backend || "node_js"),
              database: String((builderData.technology as Record<string, string>)?.database || "postgresql"),
              mobile: String((builderData.technology as Record<string, string>)?.mobile || ""),
            },
            teamRoles: (builderData.teamRoles as ProjectBuilderState["teamRoles"]) || [],
          });
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Ошибка при загрузке проекта");
        router.push("/dashboard");
      });
  }, [id, hydrate, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WizardLayout>
      {currentStep === 1 && <StepDescription />}
      {currentStep === 2 && <StepServices />}
      {currentStep === 3 && <StepTechnologies />}
      {currentStep === 4 && <StepTeam />}
      {currentStep === 5 && <StepSummary />}
    </WizardLayout>
  );
}
