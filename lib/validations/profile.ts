import { z } from "zod";

export const updateProfileSchema = z.object({
  full_name: z.string().min(2, "Минимум 2 символа").max(100, "Максимум 100 символов").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
