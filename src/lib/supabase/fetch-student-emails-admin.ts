import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function uniqueUserIds(userIds: string[]): string[] {
  return [...new Set(userIds.filter((id) => id.trim().length > 0))];
}

async function fetchEmailsFromProfileSecrets(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const emailsByUserId = new Map<string, string | null>();
  if (userIds.length === 0) {
    return emailsByUserId;
  }

  const supabase = await createClient();
  const { data: secretRows, error } = await supabase
    .from("profile_secrets")
    .select("id, email")
    .in("id", userIds);

  if (error) {
    console.warn(
      "[fetchStudentEmailsByUserIds] profile_secrets query failed",
      error.message,
    );
    return emailsByUserId;
  }

  for (const row of secretRows ?? []) {
    const email = row.email?.trim();
    if (email) {
      emailsByUserId.set(row.id, email);
    }
  }

  return emailsByUserId;
}

async function fetchEmailsFromAdminApi(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const emailsByUserId = new Map<string, string | null>();
  if (userIds.length === 0) {
    return emailsByUserId;
  }

  const admin = createAdminClient();
  if (!admin) {
    return emailsByUserId;
  }

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) {
        throw error;
      }
      return {
        userId,
        email: data.user?.email ?? null,
      };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const email = result.value.email?.trim();
      if (email) {
        emailsByUserId.set(result.value.userId, email);
      }
      continue;
    }
    console.warn(
      "[fetchStudentEmailsByUserIds] admin getUserById failed",
      result.reason,
    );
  }

  return emailsByUserId;
}

/**
 * Email учеников: сначала `public.profile_secrets` (staff / owner через RLS),
 * затем Auth Admin API при отсутствии service role или пустых строках.
 */
export async function fetchStudentEmailsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const uniqueIds = uniqueUserIds(userIds);
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const emailsByUserId = await fetchEmailsFromProfileSecrets(uniqueIds);

  const missingIds = uniqueIds.filter((id) => !emailsByUserId.has(id));
  if (missingIds.length === 0) {
    return emailsByUserId;
  }

  const adminEmails = await fetchEmailsFromAdminApi(missingIds);
  for (const [userId, email] of adminEmails) {
    emailsByUserId.set(userId, email);
  }

  const stillMissing = uniqueIds.filter((id) => !emailsByUserId.has(id));
  if (emailsByUserId.size === 0) {
    console.warn(
      "[fetchStudentEmailsByUserIds] no emails resolved via profile_secrets or admin API; matrix will show names only",
    );
  } else if (stillMissing.length > 0 && !createAdminClient()) {
    console.warn(
      `[fetchStudentEmailsByUserIds] ${stillMissing.length} student email(s) missing; add SUPABASE_SERVICE_ROLE_KEY or ensure profile_secrets.email is synced`,
    );
  }

  return emailsByUserId;
}
