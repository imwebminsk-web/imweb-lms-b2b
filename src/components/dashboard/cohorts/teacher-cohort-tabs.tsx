"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { pendingReviewBadgeClassName } from "@/lib/dashboard/pending-review-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TeacherCohortTabsProps = {
  managementNode: ReactNode;
  journalNode: ReactNode;
  chatNode: ReactNode;
  unreadCount: number;
  pendingReviewCount?: number;
};

export function TeacherCohortTabs({
  managementNode,
  journalNode,
  chatNode,
  unreadCount,
  pendingReviewCount = 0,
}: TeacherCohortTabsProps) {
  const [activeTab, setActiveTab] = useState("management");

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full"
    >
      <TabsList variant="line" className="mb-6 w-full justify-start">
        <TabsTrigger value="management">Управление</TabsTrigger>
        <TabsTrigger value="journal" className="inline-flex items-center gap-2">
          <span>Успеваемость</span>
          {pendingReviewCount > 0 ? (
            <Badge
              className={`${pendingReviewBadgeClassName} flex h-5 min-w-5 items-center justify-center rounded-full text-[10px]`}
            >
              {pendingReviewCount}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="chat" className="inline-flex items-center gap-2">
          <span>Чат группы</span>
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums"
            >
              {unreadCount}
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="management" className="mt-0 space-y-6">
        {managementNode}
      </TabsContent>

      <TabsContent value="journal" className="mt-0 space-y-6">
        {journalNode}
      </TabsContent>

      <TabsContent
        value="chat"
        forceMount
        className={cn("mt-0", activeTab !== "chat" && "hidden")}
      >
        {chatNode}
      </TabsContent>
    </Tabs>
  );
}
