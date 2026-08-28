"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { CohortChat } from "@/components/dashboard/chat/cohort-chat";
import { GradebookLegend } from "@/components/dashboard/gradebook/gradebook-legend";
import { JournalPointsDisplay } from "@/components/dashboard/gradebook/journal-points-display";
import { isGradebookDrawerOpenable } from "@/components/dashboard/gradebook/progress-status-visuals";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { TestResultSheet } from "@/components/dashboard/teacher/TestResultSheet";
import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { LearnCourseCurriculum } from "@/lib/learn/fetch-published-course";
import {
  publishedLessonsSorted,
  sortModules,
  type LearnModuleNav,
} from "@/lib/learn/curriculum-order";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  MessageCircle,
  Target,
} from "lucide-react";

export type CourseHubClientProps = {
  course: LearnCourseCurriculum;
  modules: LearnModuleNav[];
  completedLessonIds: string[];
  courseProgress: StudentProgressItem[];
  userId: string;
  userDisplayName: string;
  cohortId: string | null;
  teacherId: string;
  isChatEnabled?: boolean;
  unreadCount?: number;
};

const ROW_ICON_CLASS =
  "text-muted-foreground mr-1.5 inline-block size-3 shrink-0";

function rowTypeIcon(item: StudentProgressItem) {
  if (item.type === "assignment") {
    return <FileText className={ROW_ICON_CLASS} aria-hidden />;
  }
  if (item.testType === "training") {
    return <Target className={ROW_ICON_CLASS} aria-hidden />;
  }
  return <CheckSquare className={ROW_ICON_CLASS} aria-hidden />;
}

function ProgressLessonTitle({
  item,
  onOpen,
}: {
  item: StudentProgressItem;
  onOpen: () => void;
}) {
  const canOpen =
    isGradebookDrawerOpenable(item.status, item.points) &&
    (item.type === "assignment"
      ? Boolean(item.lessonBlockId)
      : Boolean(item.testId));

  const label = (
    <>
      {rowTypeIcon(item)}
      {item.title}
    </>
  );

  if (!canOpen) {
    return (
      <span className="inline-flex max-w-full cursor-default items-center font-medium">
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "text-primary inline-flex max-w-full cursor-pointer items-center text-left font-medium hover:underline",
      )}
    >
      {label}
    </button>
  );
}

/** Первый непройденный урок по порядку; если все пройдены — первый урок курса. */
function getContinueLessonHref(
  modules: LearnModuleNav[],
  completedIds: Set<string>,
  courseSlug: string,
): string | null {
  const sortedMods = sortModules(modules);
  let firstAny: string | null = null;
  for (const mod of sortedMods) {
    for (const l of publishedLessonsSorted(mod.lessons)) {
      if (firstAny == null) firstAny = l.id;
      if (!completedIds.has(l.id)) {
        return `/learn/${encodeURIComponent(courseSlug)}/${l.id}`;
      }
    }
  }
  return firstAny
    ? `/learn/${encodeURIComponent(courseSlug)}/${firstAny}`
    : null;
}

export function CourseHubClient({
  course,
  modules,
  completedLessonIds,
  courseProgress,
  userId,
  userDisplayName,
  cohortId,
  teacherId,
  isChatEnabled = true,
  unreadCount = 0,
}: CourseHubClientProps) {
  const { t } = useLanguage();
  const [selectedAssignment, setSelectedAssignment] = useState<{
    lessonBlockId: string;
  } | null>(null);

  const completedSet = useMemo(
    () => new Set(completedLessonIds),
    [completedLessonIds],
  );

  const [selectedTest, setSelectedTest] = useState<{
    studentId: string;
    testId: string;
    studentName: string;
    testTitle: string;
    lessonId?: string;
  } | null>(null);

  const [showTraining, setShowTraining] = useState(false);

  const hasTrainingItems = courseProgress.some(
    (item) => item.type === "test" && item.testType === "training",
  );

  const visibleProgress = useMemo(
    () =>
      courseProgress.filter(
        (item) => showTraining || item.testType !== "training",
      ),
    [courseProgress, showTraining],
  );

  const continueHref = useMemo(
    () => getContinueLessonHref(modules, completedSet, course.slug),
    [modules, completedSet, course.slug],
  );

  const [activeTab, setActiveTab] = useState("syllabus");

  return (
    <>
      <div className="space-y-6">
        <header className="space-y-4">
          <Button
            variant="ghost"
            asChild
            className="-ml-4 mb-2 w-fit text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard" className="inline-flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {t("course_view.backToDashboard")}
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {course.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("course_view.subtitle")}
            </p>
          </div>
          {continueHref ? (
            <Button asChild>
              <Link href={continueHref}>{t("course_view.continueLearning")}</Link>
            </Button>
          ) : (
            <Button type="button" disabled variant="secondary">
              {t("course_view.continueLearning")}
            </Button>
          )}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList variant="line" className="mb-4 w-full justify-start">
            <TabsTrigger value="syllabus">{t("course_view.tabSyllabus")}</TabsTrigger>
            <TabsTrigger value="progress">{t("course_view.tabProgress")}</TabsTrigger>
            <TabsTrigger value="chat" className="inline-flex items-center gap-2">
              <span>{t("course_view.tabChat")}</span>
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

          <TabsContent value="syllabus" className="mt-0 space-y-8">
            {modules.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("course_view.noModules")}
              </p>
            ) : (
              modules.map((mod) => {
                const lessons = publishedLessonsSorted(mod.lessons);
                return (
                  <section key={mod.id} className="space-y-3">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {mod.title}
                    </h2>
                    {lessons.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("course_view.noPublishedLessons")}
                      </p>
                    ) : (
                      <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
                        {lessons.map((lesson) => {
                          const done = completedSet.has(lesson.id);
                          const href = `/learn/${encodeURIComponent(course.slug)}/${lesson.id}`;
                          return (
                            <li key={lesson.id}>
                              <Link
                                href={href}
                                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                              >
                                {done ? (
                                  <CheckCircle2
                                    className="text-emerald-600 size-5 shrink-0 dark:text-emerald-400"
                                    aria-label={t("course_view.lessonCompletedAria")}
                                  />
                                ) : (
                                  <Circle
                                    className="text-muted-foreground size-5 shrink-0"
                                    aria-label={t("course_view.lessonNotCompletedAria")}
                                  />
                                )}
                                <span className="min-w-0 flex-1 font-medium leading-snug">
                                  {lesson.title}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {t("course_view.progressHint")}
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {hasTrainingItems ? (
                  <>
                    <Label
                      htmlFor="course-hub-show-training"
                      className="text-muted-foreground font-normal"
                    >
                      Показывать тренировки
                    </Label>
                    <Switch
                      id="course-hub-show-training"
                      checked={showTraining}
                      onCheckedChange={setShowTraining}
                      aria-label="Показывать тренировочные тесты"
                    />
                  </>
                ) : null}
                <GradebookLegend />
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">
                      {t("course_view.colLesson")}
                    </TableHead>
                    <TableHead className="w-[100px]">
                      {t("course_view.colPoints")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseProgress.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-muted-foreground py-10 text-center text-sm"
                      >
                        {t("course_view.noProgress")}
                      </TableCell>
                    </TableRow>
                  ) : visibleProgress.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-muted-foreground py-10 text-center text-sm"
                      >
                        Сейчас тренировочные тесты скрыты. Включите «Показывать
                        тренировки», чтобы увидеть их в журнале.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleProgress.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <ProgressLessonTitle
                            item={item}
                            onOpen={() => {
                              if (
                                item.type === "assignment" &&
                                item.lessonBlockId
                              ) {
                                setSelectedAssignment({
                                  lessonBlockId: item.lessonBlockId,
                                });
                                return;
                              }
                              if (item.testId) {
                                setSelectedTest({
                                  studentId: userId,
                                  testId: item.testId,
                                  studentName: userDisplayName,
                                  testTitle: item.title,
                                  lessonId: item.lessonId,
                                });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          <JournalPointsDisplay
                            points={item.points}
                            status={item.status}
                            compact
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent
            value="chat"
            forceMount
            className={cn("mt-0", activeTab !== "chat" && "hidden")}
          >
            {cohortId && teacherId ? (
              <CohortChat
                key={cohortId}
                cohortId={cohortId}
                currentUserId={userId}
                teacherId={teacherId}
                isChatEnabled={isChatEnabled}
                isTeacher={false}
              />
            ) : (
              <Card className="border-dashed">
                <CardHeader className="items-center text-center">
                  <div className="bg-muted mb-2 flex size-12 items-center justify-center rounded-full">
                    <MessageCircle
                      className="text-muted-foreground size-6"
                      aria-hidden
                    />
                  </div>
                  <CardTitle className="text-lg">{t("course_view.chatUnavailable")}</CardTitle>
                  <CardDescription className="max-w-md text-balance">
                    {t("course_view.chatUnavailableDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TestResultSheet
        isOpen={selectedTest != null}
        onOpenChange={(open) => {
          if (!open) setSelectedTest(null);
        }}
        studentId={selectedTest?.studentId ?? ""}
        testId={selectedTest?.testId ?? ""}
        studentName={selectedTest?.studentName ?? ""}
        testTitle={selectedTest?.testTitle ?? ""}
        lessonId={selectedTest?.lessonId}
      />

      {selectedAssignment ? (
        <AssignmentReviewSheet
          isOpen
          onOpenChange={(open) => {
            if (!open) setSelectedAssignment(null);
          }}
          fetchMode="lessonBlock"
          lessonBlockId={selectedAssignment.lessonBlockId}
          studentId={userId}
          studentName={userDisplayName}
          isTeacher={false}
        />
      ) : null}
    </>
  );
}
