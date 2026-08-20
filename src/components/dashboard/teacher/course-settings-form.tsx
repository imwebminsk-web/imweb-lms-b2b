"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateCourse,
  type UpdateCourseState,
} from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxonomyWithGroup } from "@/app/actions/taxonomy-actions";
import { type CourseTaxonomySelections } from "@/lib/course-taxonomy-map";
import type { Database } from "@/types/database.types";
import { APP_MODE } from "@/lib/config/app-mode";

import { CourseBasicInfo } from "./course-settings/course-basic-info";
import { CourseConditions } from "./course-settings/course-conditions";
import { CoursePrice } from "./course-settings/course-price";
import { CourseLanding } from "./course-settings/course-landing";
import { CourseAccess } from "./course-settings/course-access";

export type CourseSettingsFormCourse = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "description"
  | "price"
  | "status"
  | "image_url"
  | "video_url"
  | "youtube_url"
  | "vimeo_url"
  | "detailed_description"
  | "promotional_images"
  | "duration_value"
  | "duration_unit"
  | "start_date"
  | "has_certificate"
> &
  Pick<CourseTaxonomySelections, "age_group" | "delivery_format">;

const initialState: UpdateCourseState = {};

export function CourseSettingsForm({
  course,
  taxonomies,
  b2bOptions,
}: {
  course: CourseSettingsFormCourse;
  taxonomies: TaxonomyWithGroup[];
  b2bOptions?: {
    teams: { id: string; name: string }[];
    jobTitles: { id: string; name: string }[];
    tags: { id: string; name: string }[];
    selectedTeams: string[];
    selectedJobTitles: string[];
    selectedTags: string[];
    isGlobal: boolean;
  };
}) {
  const [status, setStatus] = useState(course.status);
  const [durationUnit, setDurationUnit] = useState(course.duration_unit ?? "");
  const [hasCertificate, setHasCertificate] = useState(course.has_certificate);
  const [detailedDescriptionHtml, setDetailedDescriptionHtml] = useState(
    course.detailed_description ?? "",
  );
  const [promotionalImages, setPromotionalImages] = useState<string[]>(() =>
    [...(course.promotional_images ?? [])].filter(
      (u) => typeof u === "string" && u.trim().length > 0,
    ),
  );
  
  const [selectedTeams, setSelectedTeams] = useState<string[]>(b2bOptions?.selectedTeams ?? []);
  const [selectedJobTitles, setSelectedJobTitles] = useState<string[]>(b2bOptions?.selectedJobTitles ?? []);
  const [selectedTags, setSelectedTags] = useState<string[]>(b2bOptions?.selectedTags ?? []);
  const [isGlobal, setIsGlobal] = useState<boolean>(b2bOptions?.isGlobal ?? false);

  const [viewMode, setViewMode] = useState<'b2c' | 'b2b'>('b2c');
  
  const [state, formAction, isPending] = useActionState(
    updateCourse,
    initialState,
  );

  useEffect(() => {
    setStatus(course.status);
    setDurationUnit(course.duration_unit ?? "");
    setHasCertificate(course.has_certificate);
    setDetailedDescriptionHtml(course.detailed_description ?? "");
    setPromotionalImages(
      [...(course.promotional_images ?? [])].filter(
        (u) => typeof u === "string" && u.trim().length > 0,
      ),
    );
    setSelectedTeams(b2bOptions?.selectedTeams ?? []);
    setSelectedJobTitles(b2bOptions?.selectedJobTitles ?? []);
    setSelectedTags(b2bOptions?.selectedTags ?? []);
    setIsGlobal(b2bOptions?.isGlobal ?? false);
  }, [
    course.id,
    course.status,
    course.duration_unit,
    course.has_certificate,
    course.detailed_description,
    course.promotional_images,
    b2bOptions?.selectedTeams,
    b2bOptions?.selectedJobTitles,
    b2bOptions?.selectedTags,
    b2bOptions?.isGlobal,
  ]);

  const isB2B = APP_MODE === 'corporate' || (APP_MODE === 'all' && viewMode === 'b2b');

  return (
    <Form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={course.id} />
      
      <input type="hidden" name="teams" value={JSON.stringify(selectedTeams)} />
      <input type="hidden" name="jobTitles" value={JSON.stringify(selectedJobTitles)} />
      <input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
      <input type="hidden" name="isGlobal" value={isGlobal ? "true" : "false"} />

      {APP_MODE === "all" && (
        <div className="flex justify-center pb-4">
          <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'b2c' | 'b2b')}>
            <TabsList className="grid w-full grid-cols-2 w-[400px]">
              <TabsTrigger value="b2c">Для онлайн-школы (B2C)</TabsTrigger>
              <TabsTrigger value="b2b">Для корпоратива (B2B)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <CourseBasicInfo
        course={course}
        isPending={isPending}
        isB2B={isB2B}
      />
      
      <CourseConditions
        course={course}
        durationUnit={durationUnit}
        setDurationUnit={setDurationUnit}
        hasCertificate={hasCertificate}
        setHasCertificate={setHasCertificate}
        isPending={isPending}
        isB2B={isB2B}
      />
      
      <CoursePrice
        course={course}
        isPending={isPending}
        isB2B={isB2B}
      />
      
      {!isB2B && (
        <CourseLanding
          course={course}
          detailedDescriptionHtml={detailedDescriptionHtml}
          setDetailedDescriptionHtml={setDetailedDescriptionHtml}
          promotionalImages={promotionalImages}
          setPromotionalImages={setPromotionalImages}
          isPending={isPending}
          isB2B={isB2B}
        />
      )}
      
      <CourseAccess 
        course={course}
        taxonomies={taxonomies}
        isB2B={isB2B} 
        b2bOptions={b2bOptions}
        selectedTeams={selectedTeams}
        setSelectedTeams={setSelectedTeams}
        selectedJobTitles={selectedJobTitles}
        setSelectedJobTitles={setSelectedJobTitles}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        isGlobal={isGlobal}
        setIsGlobal={setIsGlobal}
        isPending={isPending}
      />

      {/* Sticky Bottom Save Button & Status */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Статус:</span>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={isPending}
            >
              <SelectTrigger id="course-edit-status" className="w-[160px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="published">Опубликован</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="status" value={status} />
          </div>

          {state.error ? (
            <p className="text-destructive text-sm font-medium ml-4" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-emerald-600 text-sm font-medium ml-4" role="status">
              Изменения успешно сохранены.
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>
    </Form>
  );
}
