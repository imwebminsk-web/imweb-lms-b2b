"use server";

import {
  assertCourseMutationAccess,
} from "@/lib/auth/course-access";
import { verifyAccess, type Role } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type LessonForEditLesson = {
  id: string;
  title: string;
  type: string;
  content: Json | null;
  is_published: boolean;
  test_id: string | null;
  module_id: string;
  order_index: number;
};

export type LessonForEditModule = {
  id: string;
  title: string;
  course_id: string;
};

export type LessonForEditCourse = {
  id: string;
  slug: string;
  teacher_id: string;
  title: string;
};

export type LessonForEditBlock = {
  id: string;
  type: string;
  content: Json;
  order_index: number;
};

export type GetLessonForEditResult =
  | {
      ok: true;
      data: {
        lesson: LessonForEditLesson;
        module: LessonForEditModule;
        course: LessonForEditCourse;
        blocks: LessonForEditBlock[];
      };
    }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden"; error: string };

export async function getLessonForEdit(
  lessonId: string,
  expectedSlug: string,
): Promise<GetLessonForEditResult> {
  const { user, profile } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
  ]);

  const id = lessonId.trim();
  const slug = expectedSlug.trim();
  if (!id || !slug) {
    return { ok: false, reason: "not_found" };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error(
      "[getLessonForEdit] SUPABASE_SERVICE_ROLE_KEY is missing; cannot bypass RLS.",
    );
    return { ok: false, reason: "not_found" };
  }

  const { data: lesson, error: lessonError } = await adminClient
    .from("lessons")
    .select(
      "id, title, type, content, is_published, test_id, module_id, order_index",
    )
    .eq("id", id)
    .maybeSingle();

  if (lessonError) {
    console.error("[getLessonForEdit] lesson", lessonError.message);
    return { ok: false, reason: "not_found" };
  }

  if (!lesson) {
    return { ok: false, reason: "not_found" };
  }

  const { data: moduleRow, error: moduleError } = await adminClient
    .from("modules")
    .select("id, title, course_id")
    .eq("id", lesson.module_id)
    .maybeSingle();

  if (moduleError) {
    console.error("[getLessonForEdit] module", moduleError.message);
    return { ok: false, reason: "not_found" };
  }

  if (!moduleRow) {
    return { ok: false, reason: "not_found" };
  }

  const { data: course, error: courseError } = await adminClient
    .from("courses")
    .select("id, slug, teacher_id, title")
    .eq("id", moduleRow.course_id)
    .maybeSingle();

  if (courseError) {
    console.error("[getLessonForEdit] course", courseError.message);
    return { ok: false, reason: "not_found" };
  }

  if (!course || course.slug !== slug) {
    return { ok: false, reason: "not_found" };
  }

  const { data: ownerProfile, error: ownerError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", course.teacher_id)
    .maybeSingle();

  if (ownerError) {
    console.error("[getLessonForEdit] owner profile", ownerError.message);
  }

  const courseOwnerRole: Role | null = ownerProfile?.role ?? null;

  const userClient = await createClient();
  const accessError = await assertCourseMutationAccess(userClient, {
    userId: user.id,
    role: profile.role,
    courseId: course.id,
    teacherId: course.teacher_id,
    courseOwnerRole,
  });

  if (accessError) {
    return { ok: false, reason: "forbidden", error: accessError };
  }

  const { data: blockRows, error: blocksError } = await adminClient
    .from("lesson_blocks")
    .select("id, type, content, order_index")
    .eq("lesson_id", id)
    .order("order_index", { ascending: true });

  if (blocksError) {
    console.error("[getLessonForEdit] blocks", blocksError.message);
    return { ok: false, reason: "not_found" };
  }

  const blocks: LessonForEditBlock[] = (blockRows ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    content: row.content as Json,
    order_index: row.order_index,
  }));

  return {
    ok: true,
    data: {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        content: lesson.content,
        is_published: lesson.is_published,
        test_id: lesson.test_id,
        module_id: lesson.module_id,
        order_index: lesson.order_index,
      },
      module: {
        id: moduleRow.id,
        title: moduleRow.title,
        course_id: moduleRow.course_id,
      },
      course: {
        id: course.id,
        slug: course.slug,
        teacher_id: course.teacher_id,
        title: course.title,
      },
      blocks,
    },
  };
}
