import { z } from "zod";

/** Массив UUID выбранных таксономий (по одной на группу фильтра). */
export const taxonomyIdsFormSchema = z.array(z.string().uuid()).max(50);
