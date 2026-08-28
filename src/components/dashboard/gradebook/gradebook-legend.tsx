"use client";

import { HelpCircleIcon } from "lucide-react";

import {
  GRADE_COLOR_BANDS,
  PROGRESS_STATUS_VISUAL,
} from "@/components/dashboard/gradebook/progress-status-visuals";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STATUS_LEGEND = [
  PROGRESS_STATUS_VISUAL.pending,
  PROGRESS_STATUS_VISUAL.in_progress,
  PROGRESS_STATUS_VISUAL.rejected,
  PROGRESS_STATUS_VISUAL.approved_pass,
] as const;

export function GradebookLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircleIcon className="mr-2 size-4" />
          Обозначения
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <h3 className="font-medium">Статусы</h3>
            <ul className="space-y-1.5">
              {STATUS_LEGEND.map((item) => {
                const { Icon, className, label } = item;
                return (
                  <li key={label} className="flex items-center gap-2">
                    <Icon
                      className={cn("size-4 shrink-0", className)}
                      aria-hidden
                    />
                    <span>{label}</span>
                  </li>
                );
              })}
              <li className="flex items-center gap-2">
                <span
                  className="text-muted-foreground w-4 text-center tabular-nums"
                  aria-hidden
                >
                  —
                </span>
                <span>Не приступал</span>
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="font-medium">Оценки</h3>
            <ul className="space-y-1.5">
              {GRADE_COLOR_BANDS.map((band) => (
                <li key={band.label} className="flex items-center gap-2">
                  <span
                    className={cn("font-medium tabular-nums", band.className)}
                  >
                    {band.range}
                  </span>
                  <span className="text-muted-foreground">{band.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
