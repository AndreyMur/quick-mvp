import { z } from "zod";
import type { CalculationResult } from "@/lib/types/project";

const roleCostSchema = z.object({
  role: z.string(),
  label: z.string(),
  hourly_rate: z.number(),
  base_hours: z.number(),
  coefficient: z.number(),
  adjusted_hours: z.number(),
  cost: z.number(),
  count: z.number(),
  weight: z.number(),
});

const serviceCostSchema = z.object({
  key: z.string(),
  label: z.string(),
  hours: z.number(),
  cost: z.number().nullable(),
  is_custom: z.boolean(),
});

const calculationResultSchema: z.ZodType<CalculationResult> = z.object({
  version: z.string(),
  total_base_hours: z.number(),
  total_adjusted_hours: z.number(),
  total_cost: z.number(),
  calendar_days: z.number(),
  roles: z.array(roleCostSchema),
  services: z.array(serviceCostSchema),
  custom_service_fixed_cost: z.number(),
});

export const exportPdfSchema = z.object({
  project: z.object({
    name: z.string().min(1, "Название проекта обязательно").max(200),
    description: z.string().max(1000).optional().nullable(),
  }),
  result: calculationResultSchema,
  technology: z.record(z.string(), z.unknown()).optional(),
  teamRoles: z
    .array(
      z.object({
        role: z.string(),
        label: z.string(),
        count: z.number(),
      })
    )
    .optional(),
});

export type ExportPdfInput = z.infer<typeof exportPdfSchema>;
