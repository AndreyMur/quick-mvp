import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Название проекта обязательно").max(200, "Максимум 200 символов"),
  description: z.string().max(1000, "Максимум 1000 символов").optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Название проекта обязательно").max(200, "Максимум 200 символов").optional(),
  description: z.string().max(1000, "Максимум 1000 символов").optional().nullable(),
  status: z.enum(["draft", "completed"]).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
