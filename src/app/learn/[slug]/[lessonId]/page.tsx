import { notFound, redirect } from "next/navigation";

import { getStudentSubmission } from "@/app/actions/assignment-actions";
import { getLessonCompletionStatus } from "@/app/actions/lesson-completion-actions";
import type { PlayerBlockRow } from "@/components/learn/lesson-block-renderer";
import { LessonCompletionButton } from "@/components/learn/lesson-completion-button";
import { PlayerLayout } from "@/components/learn/player-layout";
import { createClient } from "@/lib/supabase/server";
import {
  collectPublishedLessonIds,
  isPublishedLessonInCourse,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import { fetchPublishedCourseForLearn } from "@/lib/learn/fetch-published-course";
import type { Database, Json } from "@/types/database.types";

type PageProps = {
  params: Promise<{ slug: string; lessonId: string }>;
};

function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

type LessonRow = Pick<
  Database["public"]["Tables"]["lessons"]["Row"],
  "id" | "title" | "type" | "content" | "is_published" | "module_id" | "test_id"
>;

export default async function LearnLessonPlayerPage({ params }: PageProps) {
  const { slug: slugParam, lessonId } = await params;
  const decodedSlug = decodeSlugParam(slugParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/learn/${slugParam}/${lessonId}`)}`,
    );
  }

  const course = await fetchPublishedCourseForLearn(decodedSlug, user.id);
  if (!course) {
    notFound();
  }

  const modules = course.modules;
  if (!isPublishedLessonInCourse(modules, lessonId)) {
    notFound();
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, type, content, is_published, module_id, test_id")
    .eq("id", lessonId)
    .eq("is_published", true)
    .maybeSingle();

  if (lessonError || !lesson) {
    notFound();
  }

  const lessonRow = lesson as LessonRow;
  const moduleIds = new Set((modules ?? []).map((m) => m.id));
  if (!moduleIds.has(lessonRow.module_id)) {
    notFound();
  }

  const { data: blockRows, error: blocksError } = await supabase
    .from("lesson_blocks")
    .select("id, type, content, order_index")
    .eq("lesson_id", lessonRow.id)
    .order("order_index", { ascending: true });

  if (blocksError) {
    console.error("[LearnLessonPlayerPage] lesson_blocks", blocksError.message);
  }

  const blocks = (blocksError ? [] : (blockRows ?? [])) as PlayerBlockRow[];

  const assignmentSubmissionsByBlockId = Object.fromEntries(
    await Promise.all(
      blocks
        .filter((b) => b.type === "assignment")
        .map(
          async (b) =>
            [b.id, await getStudentSubmission(b.id)] as [
              string,
              Awaited<ReturnType<typeof getStudentSubmission>>,
            ],
        ),
    ),
  );

  const isLessonCompleted = await getLessonCompletionStatus(lessonRow.id);
  const learnPathname = `/learn/${slugParam}/${lessonId}`;

  const publishedLessonIds = collectPublishedLessonIds(modules ?? []);
  let completedLessonIds: string[] = [];
  if (publishedLessonIds.length > 0) {
    const { data: compRows, error: compError } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("student_id", user.id)
      .in("lesson_id", publishedLessonIds);

    if (compError) {
      console.error("[LearnLessonPlayerPage] lesson_completions", compError.message);
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

  return (
    <PlayerLayout
      courseSlug={course.slug}
      courseTitle={course.title}
      activeLessonId={lessonRow.id}
      modules={modules ?? []}
      lesson={{
        id: lessonRow.id,
        title: lessonRow.title,
        type: lessonRow.type,
        content: lessonRow.content as Json,
        test_id: lessonRow.test_id,
      }}
      blocks={blocks}
      assignmentSubmissionsByBlockId={assignmentSubmissionsByBlockId}
      lessonCompletion={
        <LessonCompletionButton
          lessonId={lessonRow.id}
          initialIsCompleted={isLessonCompleted}
          pathname={learnPathname}
        />
      }
      completedLessonIds={completedLessonIds}
    />
  );
}
