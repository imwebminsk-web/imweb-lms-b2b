import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  LessonBlockEditor,
  type LessonEditorBlockRow,
} from "@/components/dashboard/teacher/lesson-block-editor";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);
  return {
    title: `Урок · ${decodedSlug}`,
    description: "Редактирование урока",
  };
}

export default async function LessonEditorPage({ params }: PageProps) {
  const { slug: slugParam, lessonId } = await params;
  const decodedSlug = decodeSlugParam(slugParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      "id, title, type, content, is_published, test_id, module_id, order_index",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError || !lesson) {
    redirect("/dashboard/courses");
  }

  const { data: module, error: moduleError } = await supabase
    .from("modules")
    .select("id, title, course_id")
    .eq("id", lesson.module_id)
    .maybeSingle();

  if (moduleError || !module) {
    redirect("/dashboard/courses");
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, slug, teacher_id, title")
    .eq("id", module.course_id)
    .maybeSingle();

  if (
    courseError ||
    !course ||
    course.teacher_id !== user.id ||
    course.slug !== decodedSlug
  ) {
    redirect("/dashboard/courses");
  }

  const { data: blockRows, error: blocksError } = await supabase
    .from("lesson_blocks")
    .select("id, type, content, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });

  if (blocksError) {
    throw new Error(blocksError.message);
  }

  const blocks: LessonEditorBlockRow[] = (blockRows ?? []).map((b) => ({
    id: b.id,
    type: b.type,
    content: b.content as Json,
    order_index: b.order_index,
  }));

  const { data: testsRows, error: testsError } = await supabase
    .from("tests")
    .select("id, title, folder_name")
    .order("title", { ascending: true });

  if (testsError) {
    throw new Error(testsError.message);
  }

  const tests = (testsRows ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    folder_name: t.folder_name,
  }));

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return (
    <>
      <SiteHeader fullName={displayName} />
      <div className="flex flex-1 flex-col">
        <LessonBlockEditor
          courseSlug={course.slug}
          courseTitle={course.title}
          lesson={{
            id: lesson.id,
            title: lesson.title,
            type: lesson.type,
            is_published: lesson.is_published,
          }}
          blocks={blocks}
          tests={tests}
        />
      </div>
    </>
  );
}
