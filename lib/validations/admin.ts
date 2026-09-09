import { z } from "zod";

export const updateUserSchema = z.object({
  project_limit: z.number().int().positive().optional(),
  is_admin: z.boolean().optional(),
  subscription_tier: z.enum(["free", "pro", "business"]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
