import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { LearnModuleNav } from "./curriculum-order";

export type LearnCourseCurriculum = {
  id: string;
  title: string;
  slug: string;
  modules: LearnModuleNav[] | null;
};

export type LearnCourseFetchError = "not_found" | "not_enrolled";

export type LearnCourseFetchResult =
  | {
      ok: true;
      course: LearnCourseCurriculum;
      cohortId: string | null;
      teacherId: string;
    }
  | {
      ok: false;
      reason: LearnCourseFetchError;
    };

export const fetchPublishedCourseForLearn = cache(
  async (
    decodedSlug: string,
    studentId: string,
  ): Promise<LearnCourseFetchResult> => {
    const supabase = await createClient();

    const { data: courseMeta, error: metaError } = await supabase
      .from("courses")
      .select("id, title, slug, teacher_id")
      .eq("slug", decodedSlug)
      .eq("status", "published")
      .maybeSingle();

    if (metaError) {
      console.error("[fetchPublishedCourseForLearn] course meta", metaError.message);
      return { ok: false, reason: "not_found" };
    }

    if (!courseMeta) {
      return { ok: false, reason: "not_found" };
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("cohort_id")
      .eq("user_id", studentId)
      .eq("course_id", courseMeta.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "[fetchPublishedCourseForLearn] enrollments",
        enrollmentError.message,
      );
      return { ok: false, reason: "not_enrolled" };
    }

    if (!enrollment) {
      return { ok: false, reason: "not_enrolled" };
    }

    const cohortId = enrollment.cohort_id ?? null;

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
      .eq("id", courseMeta.id)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[fetchPublishedCourseForLearn] curriculum", error.message);
      return { ok: false, reason: "not_found" };
    }

    const course = data as LearnCourseCurriculum | null;
    if (!course) {
      return { ok: false, reason: "not_found" };
    }

    if (!cohortId) {
      return {
        ok: true,
        course,
        cohortId: null,
        teacherId: courseMeta.teacher_id,
      };
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
      return {
        ok: true,
        course,
        cohortId,
        teacherId: courseMeta.teacher_id,
      };
    }

    const assignedLessonIds = new Set(
      (assignments ?? [])
        .map((a) => a.lesson_id)
        .filter((v): v is string => Boolean(v)),
    );

    if (assignedLessonIds.size === 0) {
      return {
        ok: true,
        course,
        cohortId,
        teacherId: courseMeta.teacher_id,
      };
    }

    return {
      ok: true,
      course: {
        ...course,
        modules:
          course.modules?.map((m) => ({
            ...m,
            lessons: m.lessons?.filter((l) => assignedLessonIds.has(l.id)) ?? [],
          })) ?? [],
      },
      cohortId,
      teacherId: courseMeta.teacher_id,
    };
  },
);
