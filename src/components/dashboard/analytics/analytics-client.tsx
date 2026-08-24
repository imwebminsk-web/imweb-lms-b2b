"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AnalyticsToolbar } from "./analytics-toolbar";
import { AnalyticsTable } from "./analytics-table";
import { CourseAnalyticsPanel } from "./course-analytics-panel";
import { EmployeeDetailsSheet } from "./employee-details-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CourseAnalyticsEmployeeRow,
  EmployeeAnalyticsRow,
} from "@/types/analytics";

function courseRowToEmployee(
  row: CourseAnalyticsEmployeeRow,
): EmployeeAnalyticsRow {
  return {
    id: row.id,
    fullName: row.fullName,
    team: row.team,
    jobTitle: row.jobTitle,
    assignedCourses: 1,
    avgProgress: row.progress,
    avgScore: 0,
    total: 1,
    completed: row.courseStatus === "completed" ? 1 : 0,
    inProgress: row.courseStatus === "in_progress" ? 1 : 0,
    notStarted: row.courseStatus === "not_started" ? 1 : 0,
    courseStatus: row.courseStatus,
    journalAssessments: [],
  };
}

export function AnalyticsClient({
  data,
  teams,
  courses,
  tags,
  defaultTab = "employees",
}: {
  data: EmployeeAnalyticsRow[];
  teams: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  tags: { id: string; label: string }[];
  defaultTab?: "employees" | "courses";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeAnalyticsRow | null>(null);

  const activeTab =
    searchParams.get("tab") === "courses" ? "courses" : defaultTab;

  function handleTabChange(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "courses") {
      params.set("tab", "courses");
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="courses">По курсам</TabsTrigger>
        </TabsList>

        <TabsContent
          value="employees"
          forceMount
          className="mt-6 space-y-6 data-[state=inactive]:hidden"
        >
          <AnalyticsToolbar teams={teams} courses={courses} tags={tags} />
          <AnalyticsTable data={data} onRowClick={setSelectedEmployee} />
        </TabsContent>

        <TabsContent
          value="courses"
          forceMount
          className="mt-6 data-[state=inactive]:hidden"
        >
          <CourseAnalyticsPanel
            courses={courses}
            onEmployeeClick={(row) =>
              setSelectedEmployee(courseRowToEmployee(row))
            }
          />
        </TabsContent>
      </Tabs>

      <EmployeeDetailsSheet
        employee={selectedEmployee}
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />
    </div>
  );
}
