import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getLessonForEdit } from "@/app/actions/lessons";
import {
  LessonBlockEditor,
  type LessonEditorBlockRow,
} from "@/components/dashboard/teacher/lesson-block-editor";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { verifyAccess } from "@/lib/auth/rbac";

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
  const { user, profile } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
  ]);

  const result = await getLessonForEdit(lessonId, decodedSlug);

  if (!result.ok && result.reason === "not_found") {
    redirect("/dashboard/courses");
  }

  if (!result.ok) {
    const displayName =
      profile.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "Пользователь";

    return (
      <>
        <SiteHeader fullName={displayName} />
        <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 px-4 py-6">
          <Button variant="link" size="sm" asChild>
            <Link href="/dashboard/courses">← Назад</Link>
          </Button>
          <div
            className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-6 text-sm"
            role="alert"
          >
            <p className="font-medium">Нет доступа к этому курсу.</p>
            <p className="mt-2 text-sm opacity-90">{result.error}</p>
          </div>
        </div>
      </>
    );
  }

  const { lesson, course, blocks } = result.data;
  const supabase = await createClient();

  const { data: testsRows, error: testsError } = await supabase
    .from("tests")
    .select("id, title, folder_name")
    .eq("scope", "library")
    .eq("is_archived", false)
    .order("title", { ascending: true });

  if (testsError) {
    throw new Error(testsError.message);
  }

  const tests = (testsRows ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    folder_name: t.folder_name,
  }));

  const editorBlocks: LessonEditorBlockRow[] = blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: block.content,
    order_index: block.order_index,
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
          blocks={editorBlocks}
          tests={tests}
        />
      </div>
    </>
  );
}
