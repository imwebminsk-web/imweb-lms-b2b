"use server";

import { createClient } from "@/lib/supabase/server";

import { fetchDashboardData, type DashboardData } from "./fetch-dashboard-data";

/**
 * Server Action: проверка сессии и загрузка дашборда (безопасно при вызове с клиента).
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return fetchDashboardData(user.id, profile.role);
}
