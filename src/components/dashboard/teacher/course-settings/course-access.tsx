"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxonomyWithGroup } from "@/app/actions/taxonomy-actions";
import { TAXONOMY_GROUP_SLUG } from "@/lib/course-taxonomy-map";
import type { CourseSettingsFormCourse } from "../course-settings-form";

const B2C_TAXONOMY_FIELDS = [
  {
    groupSlug: TAXONOMY_GROUP_SLUG.format,
    fieldName: "delivery_format" as const,
    labelFallback: "Формат проведения",
  },
  {
    groupSlug: TAXONOMY_GROUP_SLUG.ageGroup,
    fieldName: "age_group" as const,
    labelFallback: "Возрастная группа",
  },
];

type B2cFieldName = "delivery_format" | "age_group";

export type CourseAccessProps = {
  course: CourseSettingsFormCourse;
  taxonomies: TaxonomyWithGroup[];
  isB2B: boolean;
  b2bOptions?: {
    teams: { id: string; name: string }[];
    jobTitles: { id: string; name: string }[];
    tags: { id: string; name: string }[];
    selectedTeams: string[];
    selectedJobTitles: string[];
    selectedTags: string[];
    isGlobal: boolean;
  };
  selectedTeams: string[];
  setSelectedTeams: (v: string[]) => void;
  selectedJobTitles: string[];
  setSelectedJobTitles: (v: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (v: string[]) => void;
  isGlobal: boolean;
  setIsGlobal: (v: boolean) => void;
  isPending: boolean;
};

function B2cHiddenFields({
  deliveryFormat,
  ageGroup,
}: {
  deliveryFormat: string;
  ageGroup: string;
}) {
  return (
    <>
      <input type="hidden" name="age_group" value={ageGroup} />
      <input type="hidden" name="delivery_format" value={deliveryFormat} />
    </>
  );
}

export function CourseAccess({
  course,
  taxonomies,
  isB2B,
  b2bOptions,
  selectedTeams,
  setSelectedTeams,
  selectedJobTitles,
  setSelectedJobTitles,
  selectedTags,
  setSelectedTags,
  isGlobal,
  setIsGlobal,
  isPending,
}: CourseAccessProps) {
  const [deliveryFormat, setDeliveryFormat] = useState(
    course.delivery_format ?? "",
  );
  const [ageGroup, setAgeGroup] = useState(course.age_group ?? "");

  useEffect(() => {
    setDeliveryFormat(course.delivery_format ?? "");
    setAgeGroup(course.age_group ?? "");
  }, [course.id, course.delivery_format, course.age_group]);

  const taxonomySetters: Record<B2cFieldName, (v: string) => void> = {
    delivery_format: setDeliveryFormat,
    age_group: setAgeGroup,
  };

  const taxonomyValues: Record<B2cFieldName, string> = {
    delivery_format: deliveryFormat,
    age_group: ageGroup,
  };

  if (!isB2B) {
    return (
      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Настройки каталога</h3>
          <p className="text-sm text-muted-foreground">
            Маркетинговые фильтры для публичного каталога онлайн-школы.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {B2C_TAXONOMY_FIELDS.map(({ groupSlug, fieldName, labelFallback }) => {
            const options = taxonomies.filter((t) => t.group_slug === groupSlug);
            const label = options[0]?.group_name?.trim() || labelFallback;
            const value = taxonomyValues[fieldName];
            const setValue = taxonomySetters[fieldName];

            return (
              <div key={fieldName} className="space-y-2">
                <Label htmlFor={`course-${fieldName}`}>{label}</Label>
                <Select
                  value={value || "__empty__"}
                  onValueChange={(v) => setValue(v === "__empty__" ? "" : v)}
                  disabled={isPending}
                >
                  <SelectTrigger id={`course-${fieldName}`} className="w-full">
                    <SelectValue placeholder="Не выбрано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Не выбрано</SelectItem>
                    {options.length > 0 ? (
                      options.map((tax) => (
                        <SelectItem key={tax.id} value={tax.id}>
                          {tax.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_data__" disabled>
                        Нет данных в базе
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <input type="hidden" name={fieldName} value={value} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const teamsToRender = b2bOptions?.teams ?? [];
  const jobsToRender = b2bOptions?.jobTitles ?? [];
  const tagsToRender = b2bOptions?.tags ?? [];

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Корпоративный доступ</h3>
        <p className="text-sm text-muted-foreground">
          Назначьте курс сотрудникам определенных отделов, должностей или по тегам.
        </p>
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Доступно всей компании (Базовый курс)</Label>
          <p className="text-sm text-muted-foreground">
            Если включено, курс будет назначен всем сотрудникам. Настройки отделов и должностей будут проигнорированы.
          </p>
        </div>
        <Switch
          checked={isGlobal}
          onCheckedChange={setIsGlobal}
          disabled={isPending}
        />
      </div>

      <div
        className={`grid gap-8 md:grid-cols-3 transition-opacity ${isGlobal ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="space-y-4">
          <h4 className="font-medium">Отделы (Команды)</h4>
          {teamsToRender.length > 0 ? (
            <div className="space-y-3">
              {teamsToRender.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeams.includes(team.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTeams([...selectedTeams, team.id]);
                      } else {
                        setSelectedTeams(
                          selectedTeams.filter((id) => id !== team.id),
                        );
                      }
                    }}
                    disabled={isPending || isGlobal}
                  />
                  <Label
                    htmlFor={`team-${team.id}`}
                    className="font-normal cursor-pointer"
                  >
                    {team.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет данных в базе.</p>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="font-medium">Должности</h4>
          {jobsToRender.length > 0 ? (
            <div className="space-y-3">
              {jobsToRender.map((job) => (
                <div key={job.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`job-${job.id}`}
                    checked={selectedJobTitles.includes(job.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedJobTitles([...selectedJobTitles, job.id]);
                      } else {
                        setSelectedJobTitles(
                          selectedJobTitles.filter((id) => id !== job.id),
                        );
                      }
                    }}
                    disabled={isPending || isGlobal}
                  />
                  <Label
                    htmlFor={`job-${job.id}`}
                    className="font-normal cursor-pointer"
                  >
                    {job.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет данных в базе.</p>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="font-medium">Теги</h4>
          {tagsToRender.length > 0 ? (
            <div className="space-y-3">
              {tagsToRender.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag.id}`}
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTags([...selectedTags, tag.id]);
                      } else {
                        setSelectedTags(
                          selectedTags.filter((id) => id !== tag.id),
                        );
                      }
                    }}
                    disabled={isPending || isGlobal}
                  />
                  <Label
                    htmlFor={`tag-${tag.id}`}
                    className="font-normal cursor-pointer"
                  >
                    {tag.name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет данных в базе.</p>
          )}
        </div>
      </div>

      <B2cHiddenFields deliveryFormat={deliveryFormat} ageGroup={ageGroup} />
    </div>
  );
}
