import { z } from "zod";

export const changeOwnerSchema = z.object({
  courseId: z.string().trim().min(1),
  newOwnerId: z.string().trim().min(1, "Выберите нового владельца"),
});

export type ChangeOwnerPayload = z.infer<typeof changeOwnerSchema>;

export const manageCuratorSchema = z.object({
  courseId: z.string().trim().min(1),
  userId: z.string().trim().min(1, "Выберите куратора"),
});

export type ManageCuratorPayload = z.infer<typeof manageCuratorSchema>;

export const courseSettingsSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Название должно содержать минимум 2 символа"),
    slug: z
      .string()
      .trim()
      .min(2, "URL курса должен содержать минимум 2 символа"),
    description: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]),
    price: z.number().min(0, "Укажите корректную цену (число ≥ 0).").optional(),
    duration: z.union([z.string(), z.number()]).optional().nullable(),
    duration_unit: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    certificateEnabled: z.boolean().optional(),
    landingDescription: z.string().optional(),
    youtube_url: z.string().optional(),
    vimeo_url: z.string().optional(),
    promotional_images: z.array(z.string()).optional(),
    taxonomy_ids: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
    jobTitles: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    isGlobal: z.boolean().optional(),
  })
  .passthrough();

export type CourseSettingsPayload = z.infer<typeof courseSettingsSchema>;
