import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя не длиннее 100 символов"),
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
