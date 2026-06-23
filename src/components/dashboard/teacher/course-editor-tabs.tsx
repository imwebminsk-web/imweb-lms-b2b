"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  CurriculumTab,
  type CurriculumModuleRow,
} from "./curriculum-tab";
import {
  CourseSettingsForm,
  type CourseSettingsFormCourse,
} from "./course-settings-form";

export function CourseEditorTabs({
  course,
  modules,
}: {
  course: CourseSettingsFormCourse;
  modules: CurriculumModuleRow[];
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
    course.category,
    course.detailed_description,
    (course.promotional_images ?? []).join("|"),
    course.youtube_url,
    course.vimeo_url,
    course.marketing_audience,
    course.age_group,
    course.duration_value,
    course.duration_unit,
    course.start_date,
    String(course.has_certificate),
    course.level,
    course.delivery_format ?? "",
    course.language ?? "",
  ].join("|");

  return (
    <Tabs defaultValue="settings" className="w-full gap-6">
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="settings">Настройки</TabsTrigger>
        <TabsTrigger value="curriculum">Программа</TabsTrigger>
        <TabsTrigger value="students">Ученики</TabsTrigger>
      </TabsList>
      <TabsContent value="settings" className="mt-4 flex-none">
        <CourseSettingsForm course={course} key={settingsFormKey} />
      </TabsContent>
      <TabsContent value="curriculum" className="mt-4 flex-none">
        <CurriculumTab
          courseId={course.id}
          courseSlug={course.slug}
          modules={modules}
        />
      </TabsContent>
      <TabsContent value="students" className="mt-4 flex-none">
        <Card>
          <CardHeader>
            <CardTitle>Ученики</CardTitle>
            <CardDescription>Список учеников.</CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
