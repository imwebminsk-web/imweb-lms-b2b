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
  async (
    decodedSlug: string,
    studentId: string,
  ): Promise<LearnCourseCurriculum | null> => {
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
            is_published,
            test_id
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

    const course = data as LearnCourseCurriculum | null;
    if (!course) {
      return null;
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("cohort_id")
      .eq("user_id", studentId)
      .eq("course_id", course.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("[fetchPublishedCourseForLearn] enrollments", enrollmentError.message);
      return course;
    }

    const cohortId = enrollment?.cohort_id ?? null;
    if (!cohortId) {
      return course;
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("cohort_assignments")
      .select("lesson_id")
      .eq("cohort_id", cohortId)
      .not("lesson_id", "is", null);

    if (assignmentsError) {
      console.error(
        "[fetchPublishedCourseForLearn] cohort_assignments",
        assignmentsError.message,
      );
      return course;
    }

    const assignedLessonIds = new Set(
      (assignments ?? [])
        .map((a) => a.lesson_id)
        .filter((v): v is string => Boolean(v)),
    );

    if (assignedLessonIds.size === 0) {
      return course;
    }

    return {
      ...course,
      modules:
        course.modules?.map((m) => ({
          ...m,
          lessons: m.lessons?.filter((l) => assignedLessonIds.has(l.id)) ?? [],
        })) ?? [],
    };
  },
);
