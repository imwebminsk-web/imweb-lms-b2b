import {
  COHORT_STATUS_DICT,
  resolveCohortStatus,
} from "@/lib/cohort-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CohortStatusBadge({
  cohortIsArchived,
  courseIsArchived,
  cohortIsActive,
}: {
  cohortIsArchived: boolean;
  courseIsArchived: boolean;
  cohortIsActive: boolean;
}) {
  const statusKey = resolveCohortStatus(
    cohortIsArchived,
    courseIsArchived,
    cohortIsActive,
  );
  const config = COHORT_STATUS_DICT[statusKey];

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
