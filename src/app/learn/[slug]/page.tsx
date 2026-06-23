import { notFound, redirect } from "next/navigation";

import { getStudentProgress } from "@/app/actions/student-dashboard-actions";
import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { CourseHubClient } from "@/components/learn/course-hub-client";
import { createClient } from "@/lib/supabase/server";
import {
  collectPublishedLessonIds,
  sortModules,
} from "@/lib/learn/curriculum-order";
import { fetchPublishedCourseForLearn } from "@/lib/learn/fetch-published-course";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export default async function LearnCourseEntryPage({ params }: PageProps) {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/learn/${slugParam}`)}`);
  }

  const course = await fetchPublishedCourseForLearn(decodedSlug, user.id);
  if (!course) {
    notFound();
  }

  const modulesSorted = sortModules(course.modules ?? []);
  const lessonIds = collectPublishedLessonIds(modulesSorted);

  let completedLessonIds: string[] = [];
  if (lessonIds.length > 0) {
    const { data: compRows, error: compError } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("student_id", user.id)
      .in("lesson_id", lessonIds);

    if (compError) {
      console.error("[LearnCourseEntryPage] lesson_completions", compError.message);
    } else {
      completedLessonIds = [
        ...new Set(
          (compRows ?? [])
            .map((r) => r.lesson_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
    }
  }

  const progressRes = await getStudentProgress(user.id);
  if (!progressRes.success) {
    throw new Error(progressRes.error);
  }
  const courseProgress = progressRes.items.filter(
    (p) => p.courseSlug === decodedSlug,
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Студент";

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("cohort_id, courses(teacher_id)")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  if (enrollmentError) {
    console.error("[LearnCourseEntryPage] enrollments", enrollmentError.message);
  }

  const cohortId = enrollment?.cohort_id ?? null;
  const courseEnrollment = enrollment?.courses;
  const courseMeta = Array.isArray(courseEnrollment)
    ? courseEnrollment[0]
    : courseEnrollment;
  let teacherId = courseMeta?.teacher_id ?? "";

  let isChatEnabled = true;
  if (cohortId) {
    const { data: cohortRow, error: cohortRowError } = await supabase
      .from("cohorts")
      .select("is_chat_enabled")
      .eq("id", cohortId)
      .maybeSingle();

    if (cohortRowError) {
      console.error("[LearnCourseEntryPage] cohorts", cohortRowError.message);
    } else if (cohortRow) {
      isChatEnabled = cohortRow.is_chat_enabled;
    }
  }

  if (!teacherId) {
    const { data: courseRow, error: courseMetaError } = await supabase
      .from("courses")
      .select("teacher_id")
      .eq("id", course.id)
      .maybeSingle();

    if (courseMetaError) {
      console.error("[LearnCourseEntryPage] courses", courseMetaError.message);
    }
    teacherId = courseRow?.teacher_id ?? "";
  }

  const unreadRes = await getUnreadCounts();
  const unreadMap = unreadRes.success ? unreadRes.counts : {};
  const unreadCount = cohortId != null ? (unreadMap[cohortId] ?? 0) : 0;

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <CourseHubClient
        course={course}
        modules={modulesSorted}
        completedLessonIds={completedLessonIds}
        courseProgress={courseProgress}
        userId={user.id}
        userDisplayName={displayName}
        cohortId={cohortId}
        teacherId={teacherId}
        isChatEnabled={isChatEnabled}
        unreadCount={unreadCount}
      />
    </div>
  );
}
