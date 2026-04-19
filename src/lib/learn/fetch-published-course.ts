import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { LearnModuleNav } from "./curriculum-order";

export type LearnCourseCurriculum = {
  id: string;
  title: string;
  slug: string;
  modules: LearnModuleNav[] | null;
};

export const fetchPublishedCourseForLearn = cache(
  async (decodedSlug: string): Promise<LearnCourseCurriculum | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select(
        `
        id,
        title,
        slug,
        modules (
          id,
          title,
          order_index,
          lessons (
            id,
            title,
            type,
            order_index,
            is_published
          )
        )
      `,
      )
      .eq("slug", decodedSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[fetchPublishedCourseForLearn]", error.message);
      return null;
    }

    return data as LearnCourseCurriculum | null;
  },
);
