"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { readBlockSaveToJournal } from "@/lib/gradebook/journal-utils";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const lessonBlockIdSchema = z.string().uuid("Некорректный ID блока урока");
const submissionIdSchema = z.string().uuid("Некорректный ID сдачи");

function readAssignmentInstructionsFromJson(
  content: Database["public"]["Tables"]["lesson_blocks"]["Row"]["content"],
): string {
  const c = content;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    return "";
  }
  const rec = c as Record<string, unknown>;
  return typeof rec.instructions === "string" ? rec.instructions.trim() : "";
}

/** Статус сдачи: журнальные задания ждут проверки, остальные завершаются сразу. */
function submissionOutcomeForBlock(
  blockContent: Database["public"]["Tables"]["lesson_blocks"]["Row"]["content"],
): { status: "pending" | "approved"; grade: null } {
  if (readBlockSaveToJournal(blockContent)) {
    return { status: "pending", grade: null };
  }
  return { status: "approved", grade: null };
}

/** teacher_id курса, к которому относится блок урока (для проверки прав преподавателя). */
async function getCourseTeacherIdForLessonBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonBlockId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("lesson_blocks")
    .select(
      "lessons!inner(modules!inner(courses!inner(teacher_id)))",
    )
    .eq("id", lessonBlockId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const nested = data as unknown as {
    lessons?: {
      modules?: { courses?: { teacher_id: string | null } | null } | null;
    } | null;
  };
  const teacherId = nested.lessons?.modules?.courses?.teacher_id;
  return typeof teacherId === "string" ? teacherId : null;
}

export type AssignmentSubmissionRow =
  Database["public"]["Tables"]["assignment_submissions"]["Row"];

/**
 * Текущая сдача ученика по блоку (одна строка или null).
 */
export async function getStudentSubmission(
  lessonBlockId: string,
): Promise<AssignmentSubmissionRow | null> {
  const parsed = lessonBlockIdSchema.safeParse(lessonBlockId);
  if (!parsed.success) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("lesson_block_id", parsed.data)
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getStudentSubmission]", error.message);
    return null;
  }

  return data ?? null;
}

/**
 * Первая отправка или повтор после rejected. Путь для revalidate берётся с клиента (usePathname).
 */
export async function submitAssignment(
  lessonBlockId: string,
  content: string,
  pathname: string,
): Promise<void> {
  const idParsed = lessonBlockIdSchema.safeParse(lessonBlockId);
  if (!idParsed.success) {
    throw new Error(idParsed.error.issues[0]?.message ?? "Некорректный ID блока");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Введите ответ перед отправкой");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Требуется вход в систему");
  }

  const { data: block, error: blockError } = await supabase
    .from("lesson_blocks")
    .select("id, type, content")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (blockError || !block || block.type !== "assignment") {
    throw new Error("Блок не является заданием");
  }

  const submissionOutcome = submissionOutcomeForBlock(block.content);

  const { data: existing, error: existingError } = await supabase
    .from("assignment_submissions")
    .select("id, status")
    .eq("lesson_block_id", idParsed.data)
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    if (existing.status === "pending" || existing.status === "approved") {
      throw new Error("Нельзя изменить отправленное задание");
    }

    if (existing.status === "rejected") {
      const { error: updateError } = await supabase
        .from("assignment_submissions")
        .update({
          content: trimmed,
          status: submissionOutcome.status,
          grade: submissionOutcome.grade,
          teacher_comment: null,
        })
        .eq("id", existing.id)
        .eq("student_id", user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      revalidatePath(pathname);
      return;
    }
  }

  const { error: insertError } = await supabase.from("assignment_submissions").insert({
    lesson_block_id: idParsed.data,
    student_id: user.id,
    content: trimmed,
    status: submissionOutcome.status,
    grade: submissionOutcome.grade,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  revalidatePath(pathname);
}

export type AssignmentSheetPayload = {
  /** Последняя сдача по блоку или null, если ученик ещё не отправил. */
  submission: AssignmentSubmissionRow | null;
  lessonTitle: string;
  /** Текст задания (инструкция из блока). */
  assignmentText: string;
};

/** Алиас для совместимости с прежним названием. */
export type SubmissionForReviewPayload = AssignmentSheetPayload;

/**
 * Данные сдачи для шторки задания (преподаватель или владелец сдачи — ученик).
 */
export async function getSubmissionForReview(
  submissionId: string,
): Promise<
  | { success: true; data: AssignmentSheetPayload }
  | { success: false; error: string }
> {
  const parsed = submissionIdSchema.safeParse(submissionId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID сдачи",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден" };
  }

  const { data: row, error: rowError } = await supabase
    .from("assignment_submissions")
    .select(
      "*, lesson_blocks!inner ( content, lessons!inner ( title ) )",
    )
    .eq("id", parsed.data)
    .maybeSingle();

  if (rowError || !row) {
    return { success: false, error: "Сдача не найдена" };
  }

  if (profile.role === "student") {
    if (row.student_id !== user.id) {
      return { success: false, error: "Нет доступа к этой сдаче" };
    }
  } else if (profile.role === "teacher" || profile.role === "admin") {
    const courseTeacherId = await getCourseTeacherIdForLessonBlock(
      supabase,
      row.lesson_block_id,
    );

    if (!courseTeacherId) {
      return { success: false, error: "Не удалось определить курс задания" };
    }

    if (profile.role !== "admin" && courseTeacherId !== user.id) {
      return { success: false, error: "Нет доступа к этой сдаче" };
    }
  } else {
    return { success: false, error: "Недостаточно прав" };
  }

  const rowWithBlock = row as AssignmentSubmissionRow & {
    lesson_blocks: {
      content: Database["public"]["Tables"]["lesson_blocks"]["Row"]["content"];
      lessons:
        | { title: string | null }
        | { title: string | null }[]
        | null;
    };
  };
  const lessonRel = Array.isArray(rowWithBlock.lesson_blocks.lessons)
    ? rowWithBlock.lesson_blocks.lessons[0]
    : rowWithBlock.lesson_blocks.lessons;
  const lessonTitle = lessonRel?.title?.trim() || "Урок";
  const assignmentText = readAssignmentInstructionsFromJson(
    rowWithBlock.lesson_blocks.content,
  );
  const { lesson_blocks: _nested, ...submission } = rowWithBlock;

  return {
    success: true,
    data: {
      submission: submission as AssignmentSubmissionRow,
      lessonTitle,
      assignmentText,
    },
  };
}

/**
 * Данные для шторки задания по блоку и ученику (последняя сдача или «не начато»).
 */
export async function getSubmissionForReviewByLessonBlock(
  lessonBlockId: string,
  studentId: string,
): Promise<
  { success: true; data: AssignmentSheetPayload } | { success: false; error: string }
> {
  const blockParsed = lessonBlockIdSchema.safeParse(lessonBlockId);
  const studentParsed = z.string().uuid("Некорректный ID ученика").safeParse(studentId);
  if (!blockParsed.success) {
    return {
      success: false,
      error: blockParsed.error.issues[0]?.message ?? "Некорректный ID блока",
    };
  }
  if (!studentParsed.success) {
    return {
      success: false,
      error: studentParsed.error.issues[0]?.message ?? "Некорректный ID",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден" };
  }

  if (profile.role === "student") {
    if (studentParsed.data !== user.id) {
      return { success: false, error: "Нет доступа" };
    }
  } else if (profile.role === "teacher" || profile.role === "admin") {
    const courseTeacherId = await getCourseTeacherIdForLessonBlock(
      supabase,
      blockParsed.data,
    );
    if (!courseTeacherId) {
      return { success: false, error: "Не удалось определить курс задания" };
    }
    if (profile.role !== "admin" && courseTeacherId !== user.id) {
      return { success: false, error: "Нет доступа к этому заданию" };
    }
  } else {
    return { success: false, error: "Недостаточно прав" };
  }

  const { data: blockRow, error: blockErr } = await supabase
    .from("lesson_blocks")
    .select("id, type, content, lessons!inner ( title )")
    .eq("id", blockParsed.data)
    .maybeSingle();

  if (blockErr || !blockRow || blockRow.type !== "assignment") {
    return { success: false, error: "Блок задания не найден" };
  }

  const nested = blockRow as {
    content: Database["public"]["Tables"]["lesson_blocks"]["Row"]["content"];
    lessons: { title: string | null } | { title: string | null }[] | null;
  };
  const lessonRel = Array.isArray(nested.lessons)
    ? nested.lessons[0]
    : nested.lessons;
  const lessonTitle = lessonRel?.title?.trim() || "Урок";
  const assignmentText = readAssignmentInstructionsFromJson(nested.content);

  const { data: subRow, error: subErr } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("lesson_block_id", blockParsed.data)
    .eq("student_id", studentParsed.data)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    return { success: false, error: subErr.message };
  }

  return {
    success: true,
    data: {
      submission: (subRow as AssignmentSubmissionRow | null) ?? null,
      lessonTitle,
      assignmentText,
    },
  };
}

/**
 * Принять или вернуть задание; при отклонении оценка сбрасывается.
 */
export async function reviewSubmission(
  submissionId: string,
  status: "approved" | "rejected",
  grade: number | null,
  teacherComment: string | null,
  pathname: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = submissionIdSchema.safeParse(submissionId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный ID сдачи",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден" };
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    return { success: false, error: "Недостаточно прав" };
  }

  const { data: sub, error: subError } = await supabase
    .from("assignment_submissions")
    .select("id, lesson_block_id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (subError || !sub) {
    return { success: false, error: "Сдача не найдена" };
  }

  const courseTeacherId = await getCourseTeacherIdForLessonBlock(
    supabase,
    sub.lesson_block_id,
  );

  if (!courseTeacherId) {
    return { success: false, error: "Не удалось определить курс задания" };
  }

  if (profile.role !== "admin" && courseTeacherId !== user.id) {
    return { success: false, error: "Нет доступа к этой сдаче" };
  }

  const commentTrimmed =
    typeof teacherComment === "string" ? teacherComment.trim() : "";
  const commentOut = commentTrimmed.length > 0 ? commentTrimmed : null;

  let gradeOut: number | null = grade;
  if (status === "rejected") {
    gradeOut = null;
  } else if (gradeOut != null) {
    if (!Number.isInteger(gradeOut) || gradeOut < 0 || gradeOut > 100) {
      return {
        success: false,
        error: "Балл должен быть целым числом от 0 до 100 или пустым",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("assignment_submissions")
    .update({
      status,
      grade: gradeOut,
      teacher_comment: commentOut,
    })
    .eq("id", parsed.data);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(pathname);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/cohorts");
  return { success: true };
}
