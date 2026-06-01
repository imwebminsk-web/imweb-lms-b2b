"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { resolveStudentDisplayName } from "@/lib/utils/user-utils";

export type TeacherStudentCohort = {
  id: string;
  name: string;
};

export type GlobalTeacherStudent = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  cohortCount: number;
  cohorts: TeacherStudentCohort[];
  firstEnrolledAt: string;
};

type EnrollmentRow = {
  user_id: string;
  enrolled_at: string;
  cohort_id: string | null;
  cohorts: {
    id: string;
    name: string;
    courses: {
      teacher_id: string;
    } | null;
  } | null;
};

type EmailRpcRow = {
  user_id?: string;
  id?: string;
  email?: string | null;
};

function readEmailRowUserId(row: EmailRpcRow): string | null {
  const userId = row.user_id ?? row.id;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

async function assertTeacherAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Нужна авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: "Профиль не найден." };
  }

  if (profile.role !== "admin" && user.id !== teacherId) {
    return { ok: false, error: "Нет доступа к списку учеников." };
  }

  return { ok: true, userId: user.id };
}

async function getTeacherCohortIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
): Promise<string[]> {
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("teacher_id", teacherId);

  if (coursesError) {
    console.error("[getTeacherCohortIds] courses", coursesError.message);
    return [];
  }

  const courseIds = (courses ?? []).map((course) => course.id);
  if (courseIds.length === 0) {
    return [];
  }

  const { data: cohorts, error: cohortsError } = await supabase
    .from("cohorts")
    .select("id")
    .in("course_id", courseIds);

  if (cohortsError) {
    console.error("[getTeacherCohortIds] cohorts", cohortsError.message);
    return [];
  }

  return (cohorts ?? []).map((cohort) => cohort.id);
}

/**
 * Все уникальные ученики, записанные в группы курсов преподавателя.
 */
export async function getGlobalTeacherStudents(
  teacherId: string,
): Promise<
  | { success: true; students: GlobalTeacherStudent[] }
  | { success: false; error: string }
> {
  const tid = teacherId.trim();
  if (!tid) {
    return { success: false, error: "Не указан преподаватель." };
  }

  const supabase = await createClient();
  const access = await assertTeacherAccess(supabase, tid);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { data: rows, error } = await supabase
    .from("enrollments")
    .select(
      `
      user_id,
      enrolled_at,
      cohort_id,
      cohorts!inner(
        id,
        name,
        courses!inner(
          teacher_id
        )
      )
    `,
    )
    .eq("cohorts.courses.teacher_id", tid);

  if (error) {
    console.error("[getGlobalTeacherStudents]", error.message);
    return { success: false, error: error.message };
  }

  type StudentAgg = {
    cohorts: Map<string, TeacherStudentCohort>;
    firstEnrolledAt: string;
  };

  const byStudent = new Map<string, StudentAgg>();

  for (const row of (rows ?? []) as EnrollmentRow[]) {
    const cohortId = row.cohorts?.id ?? row.cohort_id;
    const cohortName = row.cohorts?.name?.trim();
    if (!cohortId || !cohortName) {
      continue;
    }

    let agg = byStudent.get(row.user_id);
    if (!agg) {
      agg = {
        cohorts: new Map<string, TeacherStudentCohort>(),
        firstEnrolledAt: row.enrolled_at,
      };
      byStudent.set(row.user_id, agg);
    }

    agg.cohorts.set(cohortId, { id: cohortId, name: cohortName });

    if (
      new Date(row.enrolled_at).getTime() <
      new Date(agg.firstEnrolledAt).getTime()
    ) {
      agg.firstEnrolledAt = row.enrolled_at;
    }
  }

  const studentIds = [...byStudent.keys()];
  const profileNameByUserId = new Map<string, string | null>();
  const emailByUserId = new Map<string, string | null>();

  if (studentIds.length > 0) {
    const [
      { data: profileRows, error: profilesError },
      { data: emailRows, error: emailsError },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", studentIds),
      supabase.rpc("get_users_emails", { p_user_ids: studentIds }),
    ]);

    if (profilesError) {
      console.error("[getGlobalTeacherStudents] profiles", profilesError.message);
    }

    if (emailsError) {
      console.error(
        "[getGlobalTeacherStudents] get_users_emails RPC failed:",
        emailsError.message,
      );
    } else if (!emailRows || emailRows.length === 0) {
      console.error(
        "[getGlobalTeacherStudents] get_users_emails returned no rows for",
        studentIds.length,
        "students",
      );
    }

    for (const profile of profileRows ?? []) {
      profileNameByUserId.set(profile.id, profile.full_name);
    }

    for (const row of (emailRows ?? []) as EmailRpcRow[]) {
      const userId = readEmailRowUserId(row);
      if (!userId) {
        console.error(
          "[getGlobalTeacherStudents] email row missing user id:",
          row,
        );
        continue;
      }
      emailByUserId.set(userId, row.email ?? null);
    }
  }

  const students: GlobalTeacherStudent[] = studentIds.map((studentId) => {
    const agg = byStudent.get(studentId)!;
    const cohorts = [...agg.cohorts.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
    const email = emailByUserId.get(studentId)?.trim() || null;

    return {
      studentId,
      studentName: resolveStudentDisplayName(
        profileNameByUserId.get(studentId),
        email,
        studentId,
      ),
      studentEmail: email ?? "—",
      cohortCount: cohorts.length,
      cohorts,
      firstEnrolledAt: agg.firstEnrolledAt,
    };
  });

  students.sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "ru", { sensitivity: "base" }),
  );

  return { success: true, students };
}

/**
 * Отчисляет ученика из выбранных групп текущего преподавателя.
 */
export async function unenrollStudentFromCohorts(
  studentId: string,
  cohortIds: string[],
): Promise<{ success: true } | { success: false; error: string }> {
  const sid = studentId.trim();
  const normalizedCohortIds = [
    ...new Set(cohortIds.map((id) => id.trim()).filter(Boolean)),
  ];

  if (!sid) {
    return { success: false, error: "Не указан ученик." };
  }

  if (normalizedCohortIds.length === 0) {
    return { success: false, error: "Выберите хотя бы одну группу." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Нужна авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Профиль не найден." };
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    return { success: false, error: "Нет прав на отчисление." };
  }

  const teacherCohortIds = new Set(await getTeacherCohortIds(supabase, user.id));
  const unauthorized = normalizedCohortIds.filter(
    (cohortId) => !teacherCohortIds.has(cohortId),
  );

  if (unauthorized.length > 0) {
    return {
      success: false,
      error: "Нет доступа к одной или нескольким выбранным группам.",
    };
  }

  const { error: deleteError } = await supabase
    .from("enrollments")
    .delete()
    .eq("user_id", sid)
    .in("cohort_id", normalizedCohortIds);

  if (deleteError) {
    console.error("[unenrollStudentFromCohorts]", deleteError.message);
    return { success: false, error: deleteError.message };
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard");

  return { success: true };
}
