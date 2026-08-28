import { cache } from "react";

import { ensureCourseEnrollment } from "@/lib/learn/verify-course-enrollment";
import { createClient } from "@/lib/supabase/server";

import type { LearnModuleNav } from "./curriculum-order";

export type LearnCourseCurriculum = {
  id: string;
  title: string;
  slug: string;
  modules: LearnModuleNav[] | null;
};

export type LearnCourseFetchError =
  | "not_found"
  | "not_enrolled"
  | "pending"
  | "suspended";

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

    const enrollment = await ensureCourseEnrollment(studentId, courseMeta.id);
    if (!enrollment.ok) {
      return { ok: false, reason: enrollment.reason };
    }

    const cohortId = enrollment.cohortId;

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
        course: {
          ...course,
          modules:
            course.modules?.map((m) => ({
              ...m,
              lessons: [],
            })) ?? [],
        },
        cohortId,
        teacherId: courseMeta.teacher_id,
      };
    }

    const assignedLessonIds = new Set(
      (assignments ?? [])
        .map((a) => a.lesson_id)
        .filter((v): v is string => Boolean(v)),
    );

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
