import { z } from "zod";

export const calculateInputSchema = z.object({
  services: z.array(z.string()).min(1, "Выберите хотя бы один сервис"),
  technologies: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    mobile: z.string().optional().nullable(),
  }),
  team: z
    .array(
      z.object({
        role: z.string(),
        count: z.number().int().positive(),
      })
    )
    .min(1, "Выберите хотя бы одну роль"),
});

export type CalculateInput = z.infer<typeof calculateInputSchema>;
