"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

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
import type { CourseSettingsPayload } from "@/lib/validations/course-schemas";
import type {
  CourseSettingsFormCourse,
  CourseTaxonomyGroupOption,
} from "../course-settings-form";

export type CourseAccessProps = {
  course: CourseSettingsFormCourse;
  taxonomies: TaxonomyWithGroup[];
  taxonomyGroups: CourseTaxonomyGroupOption[];
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

/** Раскладывает выбранные UUID по slug группы (по одному значению на группу). */
function selectionsByGroup(
  taxonomies: TaxonomyWithGroup[],
  selectedIds: string[],
): Record<string, string> {
  const selected = new Set(selectedIds);
  const byGroup: Record<string, string> = {};

  for (const tax of taxonomies) {
    if (!selected.has(tax.id) || !tax.group_slug) continue;
    if (!byGroup[tax.group_slug]) {
      byGroup[tax.group_slug] = tax.id;
    }
  }

  return byGroup;
}

export function CourseAccess({
  course,
  taxonomies,
  taxonomyGroups,
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
  const { setValue } = useFormContext<CourseSettingsPayload>();
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string>>(
    () => selectionsByGroup(taxonomies, course.taxonomy_ids),
  );

  const taxonomyIdsKey = course.taxonomy_ids.join("|");

  useEffect(() => {
    setSelectedByGroup(selectionsByGroup(taxonomies, course.taxonomy_ids));
  }, [course.id, taxonomyIdsKey, taxonomies, course.taxonomy_ids]);

  const groupsToRender = useMemo(() => {
    if (taxonomyGroups.length > 0) return taxonomyGroups;

    const seen = new Map<string, string>();
    for (const tax of taxonomies) {
      if (tax.group_slug && !seen.has(tax.group_slug)) {
        seen.set(tax.group_slug, tax.group_name || tax.group_slug);
      }
    }
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [taxonomyGroups, taxonomies]);

  useEffect(() => {
    setValue(
      "taxonomy_ids",
      Object.values(selectedByGroup).filter((id) => id.length > 0),
    );
  }, [selectedByGroup, setValue]);

  const catalogFields = (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Настройки каталога</h3>
        <p className="text-sm text-muted-foreground">
          Маркетинговые фильтры для публичного каталога онлайн-школы.
        </p>
      </div>

      {groupsToRender.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Группы фильтров ещё не созданы. Добавьте их в разделе «Фильтры каталога».
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groupsToRender.map((group) => {
            const options = taxonomies.filter((t) => t.group_slug === group.slug);
            const value = selectedByGroup[group.slug] ?? "";

            return (
              <div key={group.slug} className="space-y-2">
                <Label htmlFor={`course-taxonomy-${group.slug}`}>
                  {group.name || group.slug}
                </Label>
                <Select
                  value={value || "__empty__"}
                  onValueChange={(v) =>
                    setSelectedByGroup((prev) => ({
                      ...prev,
                      [group.slug]: v === "__empty__" ? "" : v,
                    }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger
                    id={`course-taxonomy-${group.slug}`}
                    className="w-full"
                  >
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isB2B) {
    return catalogFields;
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
    </div>
  );
}
