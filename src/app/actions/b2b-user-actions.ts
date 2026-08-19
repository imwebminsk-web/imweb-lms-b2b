"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { success: false, error: "Доступ только для администратора." };
  }

  return { supabase, userId: user.id };
}

export async function getB2BFormOptions() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth;
  }

  const { data: teams, error: teamsError } = await auth.supabase
    .from("teams")
    .select("id, name");

  const { data: jobTitles, error: jobTitlesError } = await auth.supabase
    .from("job_titles")
    .select("id, name");

  const { data: taxonomies, error: taxonomiesError } = await auth.supabase
    .from("taxonomies")
    .select("id, label")
    .order("label", { ascending: true });

  if (teamsError || jobTitlesError || taxonomiesError) {
    return { success: false, error: "Ошибка при загрузке опций." };
  }

  return {
    success: true,
    data: {
      teams: teams ?? [],
      jobTitles: jobTitles ?? [],
      taxonomies: taxonomies ?? [],
    },
  };
}

export async function getB2BUsers() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth;
  }

  const { data: profiles, error: profilesError } = await auth.supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      profile_secrets ( email ),
      team_members (
        team_id,
        job_title_id,
        teams ( name ),
        job_titles ( name )
      ),
      user_taxonomies (
        taxonomies ( id, label )
      )
    `)
    .order("full_name", { ascending: true, nullsFirst: false });

  if (profilesError) {
    console.error("[getB2BUsers]", profilesError.message);
    return { success: false, error: "Ошибка загрузки пользователей." };
  }

  return { success: true, data: profiles ?? [] };
}

export async function getB2BDashboardCourses(userId: string) {
  const supabase = await createClient();

  const { data: teamMembers, error: teamMembersError } = await supabase
    .from("team_members")
    .select("team_id, job_title_id")
    .eq("user_id", userId);

  if (teamMembersError) {
    console.error("[getB2BDashboardCourses] team_members error", teamMembersError.message);
    return { success: false, error: "Ошибка загрузки данных пользователя." };
  }

  const teamIds = teamMembers?.map((tm) => tm.team_id).filter(Boolean) ?? [];
  const jobTitleIds = teamMembers?.map((tm) => tm.job_title_id).filter(Boolean) ?? [];

  const courseIds = new Set<string>();

  if (teamIds.length > 0) {
    const { data: teamCourses } = await supabase
      .from("team_courses")
      .select("course_id")
      .in("team_id", teamIds);
    for (const tc of teamCourses ?? []) {
      courseIds.add(tc.course_id);
    }
  }

  if (jobTitleIds.length > 0) {
    const { data: jobTitleCourses } = await supabase
      .from("job_title_courses")
      .select("course_id")
      .in("job_title_id", jobTitleIds);
    for (const jtc of jobTitleCourses ?? []) {
      courseIds.add(jtc.course_id);
    }
  }

  const uniqueCourseIds = Array.from(courseIds);

  if (uniqueCourseIds.length === 0) {
    return { success: true, courses: [] };
  }

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, title, slug")
    .in("id", uniqueCourseIds)
    .eq("status", "published");

  if (coursesError) {
    console.error("[getB2BDashboardCourses] courses error", coursesError.message);
    return { success: false, error: "Ошибка загрузки курсов." };
  }

  const validCourseIds = (courses ?? []).map((c) => c.id);

  if (validCourseIds.length === 0) {
    return { success: true, courses: [] };
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, module_id, modules!inner(course_id)")
    .in("modules.course_id", validCourseIds)
    .eq("is_published", true);

  if (lessonsError) {
    console.error("[getB2BDashboardCourses] lessons error", lessonsError.message);
    return { success: false, error: "Ошибка загрузки уроков." };
  }

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const completedLessonIds = new Set<string>();

  if (lessonIds.length > 0) {
    const { data: completions } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("student_id", userId)
      .in("lesson_id", lessonIds);

    for (const c of completions ?? []) {
      if (c.lesson_id) completedLessonIds.add(c.lesson_id);
    }
  }

  const lessonCountByCourse = new Map<string, number>();
  const completedCountByCourse = new Map<string, number>();

  for (const l of lessons ?? []) {
    const courseId = (l.modules as any)?.course_id;
    if (!courseId) continue;

    lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
    if (completedLessonIds.has(l.id)) {
      completedCountByCourse.set(courseId, (completedCountByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const resultCourses = (courses ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    totalLessons: lessonCountByCourse.get(c.id) ?? 0,
    completedLessons: completedCountByCourse.get(c.id) ?? 0,
  }));

  resultCourses.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  return { success: true, courses: resultCourses };
}

export async function createB2BUser(data: {
  email: string;
  fullName: string;
  teamId: string;
  jobTitleId: string;
  taxonomyIds: string[];
}) {
  const { email, fullName, teamId, jobTitleId, taxonomyIds } = data;
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return { success: false, error: "Сервер не настроен для админ-операций." };
  }

  const password = randomBytes(8).toString("hex");

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) {
    console.error("[createB2BUser] auth error", authError.message);
    return { success: false, error: authError.message };
  }

  const userId = authData.user.id;

  // Update profile in case the trigger doesn't set the full name properly
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);

  if (profileError) {
    console.error("[createB2BUser] profile update error", profileError.message);
  }

  // Insert into team_members
  const { error: teamError } = await adminClient
    .from("team_members")
    .insert({
      user_id: userId,
      team_id: teamId,
      job_title_id: jobTitleId,
    });

  if (teamError) {
    console.error("[createB2BUser] team error", teamError.message);
  }

  // Insert taxonomies
  if (taxonomyIds && taxonomyIds.length > 0) {
    const taxInserts = taxonomyIds.map((id) => ({
      user_id: userId,
      taxonomy_id: id,
    }));
    const { error: taxError } = await adminClient
      .from("user_taxonomies")
      .insert(taxInserts);

    if (taxError) {
      console.error("[createB2BUser] tax error", taxError.message);
    }
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
