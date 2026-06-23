"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function updateProfileName(formData: FormData): Promise<void> {
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!fullName) {
    redirect("/dashboard/settings?error=empty_name");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    console.error("[updateProfileName]", error.message);
    redirect("/dashboard/settings?error=update_failed");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard/settings?saved=1");
}

export async function updateProfileAvatar(
  avatarUrl: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Требуется вход в систему" };
  }

  const normalizedUrl =
    avatarUrl != null && avatarUrl.trim().length > 0 ? avatarUrl.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: normalizedUrl })
    .eq("id", user.id);

  if (error) {
    console.error("[updateProfileAvatar]", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
