import { z } from "zod";

export const checkoutRequestSchema = z.object({
  plan: z.enum(["pro", "business"], {
    error: "Выберите тариф pro или business",
  }),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
