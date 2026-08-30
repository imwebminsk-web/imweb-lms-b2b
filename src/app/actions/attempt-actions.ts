"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const testIdSchema = z.string().uuid("Некорректный ID теста");

/**
 * Песочница преподавателя: удаляет только попытки текущего пользователя по этому тесту,
 * затем открывает маршрут прохождения как у ученика.
 */
export async function resetTeacherAttemptAndRedirect(
  testId: string,
): Promise<void> {
  const parsed = testIdSchema.safeParse(testId);
  if (!parsed.success) {
    redirect("/dashboard/tests");
  }

  const tid = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/?next=${encodeURIComponent(`/dashboard/tests/${tid}/sandbox`)}`,
    );
  }

  const { error } = await supabase
    .from("student_attempts")
    .delete()
    .eq("test_id", tid)
    .eq("student_id", user.id);

  if (error) {
    redirect("/dashboard/tests");
  }

  redirect(`/dashboard/tests/${tid}/sandbox`);
}
