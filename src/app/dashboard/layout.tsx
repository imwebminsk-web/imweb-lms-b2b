import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getSupportUnreadCount } from "@/app/actions/support-actions";
import { getUnreadCounts } from "@/app/actions/chat-receipt-actions";
import { getPendingReviewCounts } from "@/app/actions/grading-actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GlobalChatListener } from "@/components/providers/global-chat-listener";
import { GlobalSupportListener } from "@/components/providers/global-support-listener";
import {
  SUPPORT_NAV_URL,
  SupportUnreadProvider,
} from "@/components/providers/support-unread-provider";
import { createClient } from "@/lib/supabase/server";

/** URL пункта «Поддержка» — для student, admin и head_teacher. */

const SUPPORT_ROLES = new Set(["admin", "head_teacher", "student"]);

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/");
  }

  const displayName =
    profile.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Пользователь";

  let navBadges: Record<string, number> = {};
  let navPendingBadges: Record<string, number> = {};
  let supportUnreadCount = 0;

  if (SUPPORT_ROLES.has(profile.role)) {
    const supportUnreadRes = await getSupportUnreadCount();
    if (supportUnreadRes.success) {
      supportUnreadCount = supportUnreadRes.count;
      if (supportUnreadCount > 0) {
        navBadges[SUPPORT_NAV_URL] = supportUnreadCount;
      }
    }
  }

  if (profile.role === "teacher") {
    const [unreadRes, pendingRes] = await Promise.all([
      getUnreadCounts(),
      getPendingReviewCounts(),
    ]);

    if (unreadRes.success) {
      const totalUnread = Object.values(unreadRes.counts).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (totalUnread > 0) {
        navBadges = { ...navBadges, "/dashboard/cohorts": totalUnread };
      }
    }

    if (pendingRes.success) {
      const totalPending = Object.values(pendingRes.counts).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (totalPending > 0) {
        navPendingBadges = { "/dashboard/cohorts": totalPending };
      }
    }
  } else if (profile.role === "student") {
    const unreadRes = await getUnreadCounts();
    if (unreadRes.success) {
      const totalUnread = Object.values(unreadRes.counts).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (totalUnread > 0) {
        navBadges = { ...navBadges, "/dashboard": totalUnread };
      }
    }
  }

  return (
    <SupportUnreadProvider initialCount={supportUnreadCount}>
      <div className="h-full overflow-hidden">
        <GlobalChatListener />
        {profile.role !== "teacher" ? <GlobalSupportListener /> : null}
        <DashboardShell
          role={profile.role}
          navBadges={navBadges}
          navPendingBadges={navPendingBadges}
          user={{
            name: displayName,
            email: user.email ?? "",
            avatar: profile.avatar_url ?? "",
          }}
        >
          {children}
        </DashboardShell>
      </div>
    </SupportUnreadProvider>
  );
}
