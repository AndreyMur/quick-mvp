"use client";

import { useProjectBuilder } from "@/lib/stores/project-builder";
import { WizardLayout } from "@/components/builder/wizard-layout";
import { StepDescription } from "@/components/builder/step-description";
import { StepServices } from "@/components/builder/step-services";
import { StepTechnologies } from "@/components/builder/step-technologies";
import { StepTeam } from "@/components/builder/step-team";
import { StepSummary } from "@/components/builder/step-summary";

export default function NewProjectPage() {
  const { currentStep } = useProjectBuilder();

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
