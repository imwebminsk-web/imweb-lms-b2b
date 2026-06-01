import { CheckCircle, FileText, UserPlus } from "lucide-react";

import type { ActivityEvent } from "@/app/actions/activity-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  if (type === "enrollment") {
    return <UserPlus className="text-primary size-4 shrink-0" aria-hidden />;
  }
  if (type === "test") {
    return (
      <CheckCircle className="size-4 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
    );
  }
  return <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />;
}

export function ActivityFeedWidget({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Лента активности</CardTitle>
          <CardDescription>
            Последние действия учеников в ваших группах и курсах
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="border-muted-foreground/25 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
              Пока ничего не произошло.
            </div>
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border">
                    <ActivityIcon type={event.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{event.studentName}</span>{" "}
                      <span className="text-muted-foreground">
                        {event.description}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatActivityDate(event.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
