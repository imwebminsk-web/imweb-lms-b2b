"use client";

import { HelpCircleIcon } from "lucide-react";

import { CohortStatusBadge } from "@/components/dashboard/cohorts/cohort-status-badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  COHORT_STATUS_DICT,
  COHORT_STATUS_LEGEND_ORDER,
  type CohortStatusKey,
} from "@/lib/cohort-status";

const LEGEND_PREVIEW_PROPS: Record<
  CohortStatusKey,
  {
    cohortIsArchived: boolean;
    courseIsArchived: boolean;
    cohortIsActive: boolean;
  }
> = {
  active: {
    cohortIsArchived: false,
    courseIsArchived: false,
    cohortIsActive: true,
  },
  closed: {
    cohortIsArchived: false,
    courseIsArchived: false,
    cohortIsActive: false,
  },
  archived_cohort: {
    cohortIsArchived: true,
    courseIsArchived: false,
    cohortIsActive: false,
  },
  archived_course: {
    cohortIsArchived: false,
    courseIsArchived: true,
    cohortIsActive: true,
  },
};

export function CohortStatusLegend() {
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
            <h3 className="font-medium">Статусы группы</h3>
            <ul className="space-y-3">
              {COHORT_STATUS_LEGEND_ORDER.map((key) => (
                <li key={key}>
                  <div className="space-y-1">
                    <CohortStatusBadge {...LEGEND_PREVIEW_PROPS[key]} />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {COHORT_STATUS_DICT[key].description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
