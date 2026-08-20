"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  CurriculumTab,
  type CurriculumModuleRow,
} from "./curriculum-tab";
import {
  CourseSettingsForm,
  type CourseSettingsFormCourse,
} from "./course-settings-form";
import type { TaxonomyWithGroup } from "@/app/actions/taxonomy-actions";

type TaxonomyRow = TaxonomyWithGroup;

export function CourseEditorTabs({
  course,
  modules,
  taxonomies,
  b2bOptions,
}: {
  course: CourseSettingsFormCourse;
  modules: CurriculumModuleRow[];
  taxonomies: TaxonomyRow[];
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
  const settingsFormKey = [
    course.id,
    course.title,
    course.slug,
    course.price,
    course.status,
    course.description,
    course.image_url,
    course.video_url,
    course.detailed_description,
    (course.promotional_images ?? []).join("|"),
    course.youtube_url,
    course.vimeo_url,
    course.age_group,
    course.duration_value,
    course.duration_unit,
    course.start_date,
    String(course.has_certificate),
    course.delivery_format ?? "",
  ].join("|");

  return (
    <Tabs defaultValue="settings" className="w-full gap-6">
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="settings">Настройки</TabsTrigger>
        <TabsTrigger value="curriculum">Программа</TabsTrigger>
      </TabsList>
      <TabsContent value="settings" className="mt-4 flex-none">
        <CourseSettingsForm course={course} taxonomies={taxonomies} b2bOptions={b2bOptions} key={settingsFormKey} />
      </TabsContent>
      <TabsContent value="curriculum" className="mt-4 flex-none">
        <CurriculumTab
          courseId={course.id}
          courseSlug={course.slug}
          modules={modules}
        />
      </TabsContent>
    </Tabs>
  );
}
