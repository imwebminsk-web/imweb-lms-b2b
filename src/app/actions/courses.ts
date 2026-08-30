"use server";

import {
  assertCourseMutationAccess,
  getCourseOwnerRole,
} from "@/lib/auth/course-access";
import { verifyAccess, type Role } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CourseTableCurrentUser = {
  id: string;
  role: Role;
};

export type CourseB2B = {
  id: string;
  slug: string;
  title: string;
  departments: string[];
  roles: string[];
  status: "active" | "draft";
  teacherId: string;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatarUrl: string | null;
  creatorRole: Role | null;
  isCurator: boolean;
  tags: string[];
};

export type CourseB2C = {
  id: string;
  slug: string;
  title: string;
  price: number;
  status: "published" | "draft";
  teacherId: string;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatarUrl: string | null;
  creatorRole: Role | null;
  isCurator: boolean;
  tags: string[];
};

export type CourseArchived = {
  id: string;
  title: string;
  teacherId: string;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatarUrl: string | null;
  creatorRole: Role | null;
  creatorIsActive: boolean;
  isCurator: boolean;
  tags: string[];
};

const COURSE_ACCESS_SELECT = `
  teacher_id,
  creator:profiles!courses_teacher_id_fkey(full_name, role, avatar_url, is_active, profile_secrets(email)),
  curators:course_curators(user_id),
  taxonomies:course_taxonomies(taxonomies(label)),
  course_tags(tags(name))
`;

function unwrapRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function mapAccessFields(
  course: Record<string, unknown>,
  currentUserId: string,
  curatedCourseIds: string[] = [],
) {
  const creator = unwrapRel(
    course.creator as
      | {
          full_name: string | null;
          role: Role | null;
          avatar_url: string | null;
          is_active?: boolean | null;
          profile_secrets:
            | { email: string | null }
            | { email: string | null }[]
            | null;
        }
      | {
          full_name: string | null;
          role: Role | null;
          avatar_url: string | null;
          is_active?: boolean | null;
          profile_secrets:
            | { email: string | null }
            | { email: string | null }[]
            | null;
        }[]
      | null,
  );

  const emailSecret = unwrapRel(creator?.profile_secrets ?? null);

  const curators = (course.curators as Array<{ user_id: string }> | null) ?? [];

  const tagNames = (
    (course.course_tags as Array<{ tags?: { name?: string } | null }> | null) ?? []
  )
    .map((row) => row.tags?.name?.trim())
    .filter((name): name is string => Boolean(name));

  const taxonomyLabels = (
    (course.taxonomies as Array<{
      taxonomies?: { label?: string } | null;
      course_tags?: { name?: string } | null;
    }> | null) ?? []
  )
    .map((row) => row.course_tags?.name?.trim() || row.taxonomies?.label?.trim())
    .filter((name): name is string => Boolean(name));

  return {
    teacherId: String(course.teacher_id ?? ""),
    creatorName: creator?.full_name ?? null,
    creatorEmail: emailSecret?.email ?? null,
    creatorAvatarUrl: creator?.avatar_url ?? null,
    creatorRole: creator?.role ?? null,
    creatorIsActive: creator?.is_active !== false,
    isCurator:
      curatedCourseIds.includes(String(course.id ?? "")) ||
      curators.some((c) => c.user_id === currentUserId),
    tags: Array.from(new Set(tagNames.length > 0 ? tagNames : taxonomyLabels)),
  };
}

async function getCuratedCourseIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("course_curators")
    .select("course_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getCuratedCourseIds]", error.message);
    return [];
  }

  return ((data as Array<{ course_id: string }> | null) ?? [])
    .map((row) => row.course_id)
    .filter(Boolean);
}

function applyOwnerOrCuratorFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  userId: string,
  curatedIds: string[],
) {
  const curatedPart =
    curatedIds.length > 0 ? `,id.in.(${curatedIds.join(",")})` : "";
  return query.or(`teacher_id.eq.${userId}${curatedPart}`);
}

async function resolveCoursesReader(bypassRls: boolean) {
  const userClient = await createClient();
  if (!bypassRls) {
    return userClient;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error(
      "[courses] SUPABASE_SERVICE_ROLE_KEY is missing; RLS will hide other teachers' courses.",
    );
    return userClient;
  }

  return adminClient;
}

export async function getB2BCourses(
  currentUserId: string,
): Promise<{ data: CourseB2B[] | null; error: string | null }> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  try {
    const seesAllUnarchived =
      profile.role === "admin" || profile.role === "head_teacher";
    const supabase = await resolveCoursesReader(seesAllUnarchived);

    // course_curators / tags ещё нет в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("courses") as any).select(`
        id,
        slug,
        title,
        status,
        team_courses (
          teams ( name )
        ),
        job_title_courses (
          job_titles ( name )
        ),
        ${COURSE_ACCESS_SELECT}
      `);

    query = query.eq("is_archived", false);

    let curatedIds: string[] = [];
    if (!seesAllUnarchived) {
      curatedIds = await getCuratedCourseIds(supabase, user.id);
      query = applyOwnerOrCuratorFilter(query, user.id, curatedIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getB2BCourses] Supabase error:", error.message);
      return { data: null, error: "Ошибка при загрузке B2B курсов" };
    }

    const mappedData: CourseB2B[] = (data || []).map((course: Record<string, unknown>) => {
      const departments =
        ((course.team_courses as Array<{ teams?: { name?: string } }> | null) ?? [])
          .map((tc) => tc.teams?.name)
          .filter((name): name is string => Boolean(name));

      const roles =
        ((course.job_title_courses as Array<{ job_titles?: { name?: string } }> | null) ?? [])
          .map((jtc) => jtc.job_titles?.name)
          .filter((name): name is string => Boolean(name));

      return {
        id: String(course.id),
        slug: String(course.slug ?? ""),
        title: String(course.title ?? ""),
        departments: Array.from(new Set(departments)),
        roles: Array.from(new Set(roles)),
        status: course.status === "published" ? "active" : "draft",
        ...mapAccessFields(course, currentUserId, curatedIds),
      };
    });

    return { data: mappedData, error: null };
  } catch (err: unknown) {
    console.error("[getB2BCourses] Unexpected error:", err);
    return { data: null, error: "Внутренняя ошибка сервера" };
  }
}

export async function getB2CCourses(
  currentUserId: string,
): Promise<{ data: CourseB2C[] | null; error: string | null }> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  try {
    const seesAllUnarchived =
      profile.role === "admin" || profile.role === "head_teacher";
    const supabase = await resolveCoursesReader(seesAllUnarchived);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("courses") as any).select(`
        id,
        slug,
        title,
        price,
        status,
        ${COURSE_ACCESS_SELECT}
      `);

    query = query.eq("is_archived", false);

    let curatedIds: string[] = [];
    if (!seesAllUnarchived) {
      curatedIds = await getCuratedCourseIds(supabase, user.id);
      query = applyOwnerOrCuratorFilter(query, user.id, curatedIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getB2CCourses] Supabase error:", error.message);
      return { data: null, error: "Ошибка при загрузке B2C курсов" };
    }

    const mappedData: CourseB2C[] = (data || []).map((course: Record<string, unknown>) => {
      return {
        id: String(course.id),
        slug: String(course.slug ?? ""),
        title: String(course.title ?? ""),
        price: parseFloat(String(course.price ?? "0")) || 0,
        status: course.status === "published" ? "published" : "draft",
        ...mapAccessFields(course, currentUserId, curatedIds),
      };
    });

    return { data: mappedData, error: null };
  } catch (err: unknown) {
    console.error("[getB2CCourses] Unexpected error:", err);
    return { data: null, error: "Внутренняя ошибка сервера" };
  }
}

export async function getArchivedCourses(): Promise<{
  data: CourseArchived[] | null;
  error: string | null;
}> {
  const { user, profile } = await verifyAccess(["admin"]);

  if (profile.role !== "admin") {
    return { data: null, error: "Архив доступен только администратору." };
  }

  try {
    const supabase = await resolveCoursesReader(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("courses") as any)
      .select(
        `
        id,
        title,
        ${COURSE_ACCESS_SELECT}
      `,
      )
      .eq("is_archived", true)
      .order("title", { ascending: true });

    if (error) {
      console.error("[getArchivedCourses] Supabase error:", error.message);
      return { data: null, error: "Ошибка при загрузке архива курсов" };
    }

    const mappedData: CourseArchived[] = (data || []).map(
      (course: Record<string, unknown>) => {
        const access = mapAccessFields(course, user.id);
        return {
          id: String(course.id),
          title: String(course.title ?? ""),
          ...access,
          creatorIsActive: access.creatorIsActive,
        };
      },
    );

    return { data: mappedData, error: null };
  } catch (err: unknown) {
    console.error("[getArchivedCourses] Unexpected error:", err);
    return { data: null, error: "Внутренняя ошибка сервера" };
  }
}

const COURSE_EDITOR_SELECT = `
  id,
  title,
  description,
  detailed_description,
  price,
  status,
  slug,
  image_url,
  video_url,
  youtube_url,
  vimeo_url,
  category,
  has_certificate,
  is_global,
  teacher_id,
  creator:profiles!courses_teacher_id_fkey(role),
  curators:course_curators(user_id),
  course_taxonomies (
    taxonomy_id
  ),
  promotional_images,
  duration_value,
  duration_unit,
  start_date,
  modules (
    id,
    title,
    order_index,
    lessons (
      id,
      title,
      type,
      is_published,
      order_index
    )
  )
`;

export type CourseEditorLessonRow = {
  id: string;
  title: string;
  type: string;
  is_published: boolean;
  order_index: number;
};

export type CourseEditorModuleRow = {
  id: string;
  title: string;
  order_index: number;
  lessons: CourseEditorLessonRow[] | null;
};

export type CourseEditorQueryRow = {
  id: string;
  title: string;
  description: string | null;
  detailed_description: string | null;
  price: number | string | null;
  status: string;
  slug: string;
  image_url: string | null;
  video_url: string | null;
  youtube_url: string | null;
  vimeo_url: string | null;
  category: string | null;
  has_certificate: boolean | null;
  is_global: boolean | null;
  teacher_id: string;
  creator: { role: Role | null } | { role: Role | null }[] | null;
  course_taxonomies: Array<{ taxonomy_id: string | null }> | null;
  promotional_images: string[] | null;
  duration_value: number | null;
  duration_unit: string | null;
  start_date: string | null;
  modules: CourseEditorModuleRow[] | null;
};

export type GetCourseForEditBySlugResult =
  | { ok: true; course: CourseEditorQueryRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden"; error: string };

export async function getCourseForEditBySlug(
  slug: string,
): Promise<GetCourseForEditBySlugResult> {
  const { user, profile } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
  ]);

  const decodedSlug = slug.trim();
  if (!decodedSlug) {
    return { ok: false, reason: "not_found" };
  }

  const reader = await resolveCoursesReader(true);
  const userClient = await createClient();

  // Nested editor fields are not all in generated Database types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course, error } = await (reader.from("courses") as any)
    .select(COURSE_EDITOR_SELECT)
    .eq("slug", decodedSlug)
    .maybeSingle();

  if (error) {
    console.error("[getCourseForEditBySlug]", error.message);
    return { ok: false, reason: "not_found" };
  }

  if (!course) {
    return { ok: false, reason: "not_found" };
  }

  const accessError = await assertCourseMutationAccess(userClient, {
    userId: user.id,
    role: profile.role,
    courseId: String(course.id),
    teacherId: String(course.teacher_id),
    courseOwnerRole: getCourseOwnerRole({
      owner: (course as { creator?: unknown }).creator,
    }),
  });

  if (accessError) {
    return { ok: false, reason: "forbidden", error: accessError };
  }

  return { ok: true, course: course as CourseEditorQueryRow };
}
