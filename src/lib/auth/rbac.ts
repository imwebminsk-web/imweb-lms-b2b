import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Role = Database["public"]["Enums"]["profile_role"];

export async function verifyAccess(allowedRoles: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    // is_active ещё нет в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("role, is_active" as any)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/");
  }

  if ((profile as { is_active?: boolean | null }).is_active === false) {
    redirect("/?error=account_deactivated");
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect("/dashboard");
  }

  return { user, profile };
}
