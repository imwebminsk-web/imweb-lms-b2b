import { z } from "zod";

/** Строка таблицы дашборда (совместима с колонками shadcn DataTable). */
export const dashboardTableRowSchema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  /** URL-сегмент публичной страницы курса (`/courses/[slug]`). */
  slug: z.string(),
  reviewer: z.string(),
});

export type DashboardTableRow = z.infer<typeof dashboardTableRowSchema>;
