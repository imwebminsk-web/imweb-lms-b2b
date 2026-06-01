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
