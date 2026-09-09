"use client";

import React from "react";
import { useProjectBuilder } from "@/lib/stores/project-builder";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import Link from "next/link";

const stepLabels = [
  "Описание",
  "Сервисы",
  "Технологии",
  "Команда",
  "Саммари",
];

interface WizardLayoutProps {
  children: React.ReactNode;
  stepContent?: React.ReactNode;
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    canProceed,
    setCurrentStep,
  } = useProjectBuilder();

  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
  const canGoNext = canProceed();

  const handleNext = () => {
    if (canGoNext && currentStep < totalSteps) {
      nextStep();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-10 px-4 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {stepLabels.map((label, index) => {
              const stepNum = index + 1;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;

              return (
                <button
                  key={stepNum}
                  onClick={() => stepNum < currentStep && setCurrentStep(stepNum)}
                  className={`flex flex-col items-center gap-2 transition-colors ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                  disabled={stepNum > currentStep}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-muted text-foreground"
                          : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                  </div>
                  <span className="text-xs hidden sm:block">{label}</span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="mb-8">{children}</div>

        <div className="flex items-center justify-between pt-6 border-t">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={prevStep} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Button>
          ) : (
            <Link href="/dashboard">
              <Button variant="outline">Отмена</Button>
            </Link>
          )}

          {currentStep < totalSteps ? (
            <Button onClick={handleNext} disabled={!canGoNext} className="gap-2">
              Далее
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}
        </div>
      </main>
    </div>
  );
}
