"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider as Form, useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateCourse } from "@/app/actions/course-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxonomyWithGroup } from "@/app/actions/taxonomy-actions";
import type { Database } from "@/types/database.types";
import { APP_MODE } from "@/lib/config/app-mode";
import {
  courseSettingsSchema,
  type CourseSettingsPayload,
} from "@/lib/validations/course-schemas";

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
> & {
  taxonomy_ids: string[];
};

export type CourseTaxonomyGroupOption = {
  slug: string;
  name: string;
};

function initialPrice(raw: string): number | undefined {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CourseSettingsForm({
  course,
  taxonomies,
  taxonomyGroups,
  b2bOptions,
}: {
  course: CourseSettingsFormCourse;
  taxonomies: TaxonomyWithGroup[];
  taxonomyGroups: CourseTaxonomyGroupOption[];
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
  const router = useRouter();
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    b2bOptions?.selectedTeams ?? [],
  );
  const [selectedJobTitles, setSelectedJobTitles] = useState<string[]>(
    b2bOptions?.selectedJobTitles ?? [],
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    b2bOptions?.selectedTags ?? [],
  );
  const [isGlobal, setIsGlobal] = useState<boolean>(b2bOptions?.isGlobal ?? false);

  const [viewMode, setViewMode] = useState<"b2c" | "b2b">("b2c");

  const form = useForm<CourseSettingsPayload>({
    resolver: zodResolver(courseSettingsSchema),
    defaultValues: {
      title: course.title,
      slug: course.slug,
      description: course.description ?? "",
      status: course.status,
      price: initialPrice(course.price),
      duration: course.duration_value,
      duration_unit: course.duration_unit ?? "",
      start_date: course.start_date ? course.start_date.slice(0, 10) : "",
      certificateEnabled: course.has_certificate,
      landingDescription: course.detailed_description ?? "",
      youtube_url: course.youtube_url ?? "",
      vimeo_url: course.vimeo_url ?? "",
      promotional_images: [...(course.promotional_images ?? [])].filter(
        (u) => typeof u === "string" && u.trim().length > 0,
      ),
      taxonomy_ids: course.taxonomy_ids,
      teams: b2bOptions?.selectedTeams ?? [],
      jobTitles: b2bOptions?.selectedJobTitles ?? [],
      tags: b2bOptions?.selectedTags ?? [],
      isGlobal: b2bOptions?.isGlobal ?? false,
    },
  });

  const isPending = form.formState.isSubmitting;
  const isB2B = APP_MODE === "corporate" || (APP_MODE === "all" && viewMode === "b2b");

  async function onSubmit(values: CourseSettingsPayload) {
    const result = await updateCourse(course.id, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Изменения успешно сохранены.");
    router.refresh();
    if (values.slug.trim() !== course.slug) {
      router.push(`/dashboard/courses/${encodeURIComponent(values.slug.trim())}`);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {APP_MODE === "all" && (
          <div className="flex justify-center pb-4">
            <Tabs
              value={viewMode}
              onValueChange={(val) => setViewMode(val as "b2c" | "b2b")}
            >
              <TabsList className="grid w-full grid-cols-2 w-[400px]">
                <TabsTrigger value="b2c">Для онлайн-школы (B2C)</TabsTrigger>
                <TabsTrigger value="b2b">Для корпоратива (B2B)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <CourseBasicInfo course={course} isPending={isPending} isB2B={isB2B} />

        <CourseConditions isPending={isPending} isB2B={isB2B} />

        <CoursePrice isPending={isPending} isB2B={isB2B} />

        {!isB2B && (
          <CourseLanding course={course} isPending={isPending} isB2B={isB2B} />
        )}

        <CourseAccess
          course={course}
          taxonomies={taxonomies}
          taxonomyGroups={taxonomyGroups}
          isB2B={isB2B}
          b2bOptions={b2bOptions}
          selectedTeams={selectedTeams}
          setSelectedTeams={(next) => {
            setSelectedTeams(next);
            form.setValue("teams", next);
          }}
          selectedJobTitles={selectedJobTitles}
          setSelectedJobTitles={(next) => {
            setSelectedJobTitles(next);
            form.setValue("jobTitles", next);
          }}
          selectedTags={selectedTags}
          setSelectedTags={(next) => {
            setSelectedTags(next);
            form.setValue("tags", next);
          }}
          isGlobal={isGlobal}
          setIsGlobal={(next) => {
            setIsGlobal(next);
            form.setValue("isGlobal", next);
          }}
          isPending={isPending}
        />

        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t bg-background/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Статус:</span>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
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
                )}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending} size="lg">
            {isPending ? "Сохранение…" : "Сохранить изменения"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
