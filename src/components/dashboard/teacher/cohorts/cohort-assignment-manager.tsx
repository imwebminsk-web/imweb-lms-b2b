"use client";

import { useMemo, useState, useTransition } from "react";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";

import {
  assignContentToCohort,
  bulkAssignContentToCohort,
  bulkUnassignContentFromCohort,
  unassignContentFromCohort,
} from "@/app/actions/cohort-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

type ModuleLessonItem = {
  id: string;
  title: string;
  hasTest: boolean;
  isPublished: boolean;
};

type AssignmentModule = {
  id: string;
  title: string;
  position: number;
  lessons: ModuleLessonItem[];
};

type CohortAssignmentManagerProps = {
  cohortId: string;
  modules: AssignmentModule[];
  assignedLessonIds: string[];
};

export function CohortAssignmentManager({
  cohortId,
  modules,
  assignedLessonIds,
}: CohortAssignmentManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [localAssignedLessons, setLocalAssignedLessons] = useState(
    () => new Set(assignedLessonIds),
  );
  const [inFlightLessonIds, setInFlightLessonIds] = useState<Set<string>>(
    () => new Set(),
  );

  const moduleRows = useMemo(
    () => [...modules].sort((a, b) => a.position - b.position),
    [modules],
  );
  const allLessonIds = useMemo(
    () => moduleRows.flatMap((m) => m.lessons.map((l) => l.id)),
    [moduleRows],
  );

  function toggleLesson(lessonId: string, nextChecked: boolean) {
    if (inFlightLessonIds.has(lessonId)) return;

    const prev = new Set(localAssignedLessons);
    const next = new Set(localAssignedLessons);
    if (nextChecked) next.add(lessonId);
    else next.delete(lessonId);
    setLocalAssignedLessons(next);
    setInFlightLessonIds((prevSet) => new Set(prevSet).add(lessonId));

    startTransition(async () => {
      try {
        const res = nextChecked
          ? await assignContentToCohort({ cohortId, lessonId })
          : await unassignContentFromCohort({ cohortId, lessonId });

        if (!res.success) {
          setLocalAssignedLessons(prev);
          toast.error(res.error);
        } else {
          toast.success(nextChecked ? "Урок назначен группе" : "Назначение урока снято");
        }
      } finally {
        setInFlightLessonIds((prevSet) => {
          const nextSet = new Set(prevSet);
          nextSet.delete(lessonId);
          return nextSet;
        });
      }
    });
  }

  function runBulkForItems(items: string[], mode: "assign" | "unassign") {
    const payload = items.map((id) => ({ id, type: "lesson" as const }));
    if (payload.length === 0) return;
    const payloadIds = new Set(payload.map((p) => p.id));

    const prevLessons = new Set(localAssignedLessons);
    const nextLessons = new Set(localAssignedLessons);

    for (const lessonId of payloadIds) {
      if (mode === "assign") nextLessons.add(lessonId);
      else nextLessons.delete(lessonId);
    }
    setLocalAssignedLessons(nextLessons);

    startTransition(async () => {
      const result =
        mode === "assign"
          ? await bulkAssignContentToCohort(cohortId, payload)
          : await bulkUnassignContentFromCohort(cohortId, payload);
      if (!result.success) {
        setLocalAssignedLessons(prevLessons);
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "assign"
          ? "Назначения для выбранного списка обновлены"
          : "Назначения для выбранного списка сняты",
      );
    });
  }

  function toggleModuleLessons(
    lessonIds: string[],
    mode: "assign" | "unassign",
  ) {
    runBulkForItems(lessonIds, mode);
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 border rounded-lg p-4 text-sm">
        <div className="flex items-start gap-2">
          <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground">
            Подсказка: Ученики видят только отмеченные модули и уроки. Если снять
            все галочки, курс будет полностью скрыт. При добавлении новых модулей
            или уроков не забудьте отметить их здесь для открытия доступа.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => runBulkForItems(allLessonIds, "assign")}
          disabled={isPending || allLessonIds.length === 0}
        >
          Выбрать всё
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => runBulkForItems(allLessonIds, "unassign")}
          disabled={isPending || allLessonIds.length === 0}
        >
          Снять всё
        </Button>
      </div>

      {moduleRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">В курсе пока нет модулей.</p>
      ) : (
        <Accordion type="multiple" className="w-full space-y-2">
          {moduleRows.map((module) => {
            const moduleLessonIds = module.lessons.map((l) => l.id);
            const assignedCount = moduleLessonIds.filter((id) =>
              localAssignedLessons.has(id),
            ).length;
            const allAssigned =
              moduleLessonIds.length > 0 && assignedCount === moduleLessonIds.length;
            const noneAssigned = assignedCount === 0;
            const moduleCheckState: boolean | "indeterminate" = allAssigned
              ? true
              : noneAssigned
                ? false
                : "indeterminate";

            return (
              <AccordionItem
                key={module.id}
                value={module.id}
                className="rounded-lg border px-3"
              >
                <div className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={moduleCheckState}
                      onCheckedChange={(checked) =>
                        toggleModuleLessons(
                          moduleLessonIds,
                          checked === true ? "assign" : "unassign",
                        )
                      }
                      disabled={isPending || moduleLessonIds.length === 0}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{module.title}</span>
                      <span className="text-muted-foreground text-xs">
                        Назначено: {assignedCount} из {moduleLessonIds.length} уроков
                      </span>
                    </div>
                  </div>
                  <AccordionTrigger className="py-0"> </AccordionTrigger>
                </div>

                <AccordionContent className="pb-3">
                  <div className="space-y-2">
                    {module.lessons.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        В модуле пока нет уроков.
                      </p>
                    ) : (
                      module.lessons.map((lesson) => (
                        <label
                          key={lesson.id}
                          className={`flex items-center gap-3 rounded-md border px-3 py-2 ${inFlightLessonIds.has(lesson.id) ? "opacity-70" : ""}`}
                        >
                          <Checkbox
                            checked={localAssignedLessons.has(lesson.id)}
                            onCheckedChange={(checked) =>
                              toggleLesson(lesson.id, checked === true)
                            }
                            disabled={isPending || inFlightLessonIds.has(lesson.id)}
                          />
                          <span className="text-sm">{lesson.title}</span>
                          {!lesson.isPublished ? (
                            <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              [Черновик]
                            </span>
                          ) : null}
                          {lesson.hasTest ? (
                            <Badge variant="secondary" className="ml-2">
                              📝 Тест
                            </Badge>
                          ) : null}
                          {inFlightLessonIds.has(lesson.id) ? (
                            <span
                              className="ml-auto size-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground"
                              aria-hidden
                            />
                          ) : null}
                        </label>
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
