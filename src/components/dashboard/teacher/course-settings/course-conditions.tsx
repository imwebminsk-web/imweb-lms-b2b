"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseSettingsFormCourse } from "../course-settings-form";

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CourseConditions({
  course,
  durationUnit,
  setDurationUnit,
  hasCertificate,
  setHasCertificate,
  isPending,
  isB2B,
}: {
  course: CourseSettingsFormCourse;
  durationUnit: string;
  setDurationUnit: (v: string) => void;
  hasCertificate: boolean;
  setHasCertificate: (v: boolean) => void;
  isPending: boolean;
  isB2B: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Условия и длительность</h3>
      </div>
      
      <input type="hidden" name="duration_unit" value={durationUnit} />
      <input type="hidden" name="has_certificate" value={hasCertificate ? "true" : "false"} />

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="course-duration-value">Длительность (число)</Label>
            <Input
              id="course-duration-value"
              name="duration_value"
              type="number"
              min={0}
              step={1}
              placeholder="Например, 8"
              defaultValue={
                course.duration_value != null
                  ? String(course.duration_value)
                  : ""
              }
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="course-duration-unit">Единица</Label>
            <Select
              value={durationUnit || "__empty__"}
              onValueChange={(v) =>
                setDurationUnit(v === "__empty__" ? "" : v)
              }
              disabled={isPending}
            >
              <SelectTrigger
                id="course-duration-unit"
                className="w-full"
              >
                <SelectValue placeholder="Не выбрано" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">Не выбрано</SelectItem>
                <SelectItem value="hours">Часов</SelectItem>
                <SelectItem value="weeks">Недель</SelectItem>
                <SelectItem value="months">Месяцев</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className={`grid gap-2 ${isB2B ? "hidden" : ""}`}>
          <Label htmlFor="course-start-date">Дата старта</Label>
          <Input
            id="course-start-date"
            name="start_date"
            type="date"
            defaultValue={dateInputValue(course.start_date)}
            disabled={isPending}
          />
          <p className="text-muted-foreground text-xs">
            Оставьте пустым, если дата не фиксирована.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="course-certificate"
            checked={hasCertificate}
            onCheckedChange={(v) => setHasCertificate(v === true)}
            disabled={isPending}
          />
          <Label htmlFor="course-certificate" className="cursor-pointer font-normal">
            Выдаётся сертификат
          </Label>
        </div>
      </div>
    </div>
  );
}
