import { z } from "zod";

export const CREATE_USER_ROLES = [
  "admin",
  "head_teacher",
  "teacher",
  "student",
] as const;

export const createUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя не длиннее 100 символов"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Укажите корректный email"),
  role: z.enum(CREATE_USER_ROLES, {
    message: "Выберите роль",
  }),
  password: z.string().min(8, "Пароль не короче 8 символов"),
});

export type CreateUserPayload = z.infer<typeof createUserSchema>;
