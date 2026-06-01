"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  updateCourse,
  uploadCourseGalleryImage,
  type UpdateCourseState,
} from "@/app/actions/course-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Editor } from "@/components/ui/editor";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/utils/image-compression";
import type { Database } from "@/types/database.types";
import {
  AGE_GROUP_LABELS,
  COURSE_LANGUAGE_LABELS,
  DELIVERY_FORMAT_LABELS,
} from "@/lib/validations/course-settings-schema";

import { CourseImageUpload } from "./course-image-upload";
import { CourseVideoUpload } from "./course-video-upload";

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
  | "category"
  | "detailed_description"
  | "promotional_images"
  | "marketing_audience"
  | "age_group"
  | "duration_value"
  | "duration_unit"
  | "start_date"
  | "has_certificate"
  | "level"
  | "delivery_format"
  | "language"
>;

type CourseLevel = Database["public"]["Enums"]["course_level"];

const initialState: UpdateCourseState = {};

/** Легаси-коды (kids/…) → русские метки после миграции. */
function normalizeMarketingAudience(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "";
  const v = String(raw).trim();
  const legacy: Record<string, string> = {
    kids: "Дети",
    adults: "Взрослые",
    all: "Все",
    teens: "",
  };
  if (v in legacy) return legacy[v] ?? "";
  if (v === "Дети" || v === "Взрослые" || v === "Все") return v;
  return "";
}

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CourseSettingsForm({
  course,
}: {
  course: CourseSettingsFormCourse;
}) {
  const [status, setStatus] = useState(course.status);
  const [level, setLevel] = useState<CourseLevel | "">(
    (course.level ?? "") as CourseLevel | "",
  );
  const [marketingAudience, setMarketingAudience] = useState(() =>
    normalizeMarketingAudience(course.marketing_audience),
  );
  const [ageGroup, setAgeGroup] = useState(course.age_group ?? "");
  const [deliveryFormat, setDeliveryFormat] = useState(
    course.delivery_format ?? "",
  );
  const [language, setLanguage] = useState(course.language ?? "");
  const [durationUnit, setDurationUnit] = useState(
    course.duration_unit ?? "",
  );
  const [hasCertificate, setHasCertificate] = useState(course.has_certificate);
  const [detailedDescriptionHtml, setDetailedDescriptionHtml] = useState(
    course.detailed_description ?? "",
  );
  const [promotionalImages, setPromotionalImages] = useState<string[]>(() =>
    [...(course.promotional_images ?? [])].filter(
      (u) => typeof u === "string" && u.trim().length > 0,
    ),
  );
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateCourse,
    initialState,
  );

  async function onGalleryFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setGalleryBusy(true);
    try {
      let count = promotionalImages.length;
      for (const raw of files) {
        if (count >= 24) {
          toast.error("В галерее не более 24 изображений.");
          break;
        }
        try {
          const compressed = await compressImage(raw);
          if (compressed.size > 100 * 1024) {
            toast.error(
              `${raw.name}: после сжатия файл всё ещё больше 100 КБ.`,
            );
            continue;
          }
          const fd = new FormData();
          fd.append("file", compressed);
          const res = await uploadCourseGalleryImage(course.id, fd);
          if ("error" in res) {
            toast.error(res.error);
            continue;
          }
          setPromotionalImages((prev) => [...prev, res.url]);
          count += 1;
          toast.success("Изображение добавлено в галерею");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Не удалось обработать файл.",
          );
        }
      }
    } finally {
      setGalleryBusy(false);
    }
  }

  useEffect(() => {
    setStatus(course.status);
    setLevel((course.level ?? "") as CourseLevel | "");
    setMarketingAudience(normalizeMarketingAudience(course.marketing_audience));
    setAgeGroup(course.age_group ?? "");
    setDeliveryFormat(course.delivery_format ?? "");
    setLanguage(course.language ?? "");
    setDurationUnit(course.duration_unit ?? "");
    setHasCertificate(course.has_certificate);
    setDetailedDescriptionHtml(course.detailed_description ?? "");
    setPromotionalImages(
      [...(course.promotional_images ?? [])].filter(
        (u) => typeof u === "string" && u.trim().length > 0,
      ),
    );
  }, [
    course.id,
    course.status,
    course.level,
    course.marketing_audience,
    course.age_group,
    course.delivery_format,
    course.language,
    course.duration_unit,
    course.has_certificate,
    course.image_url,
    course.video_url,
    course.detailed_description,
    course.promotional_images,
  ]);

  return (
    <Form action={formAction} className="space-y-8">
      <input type="hidden" name="id" value={course.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="marketing_audience" value={marketingAudience} />
      {marketingAudience === "Взрослые" && level !== "" ? (
        <input type="hidden" name="level" value={level} />
      ) : null}
      {marketingAudience === "Дети" && ageGroup !== "" ? (
        <input type="hidden" name="age_group" value={ageGroup} />
      ) : null}
      <input type="hidden" name="duration_unit" value={durationUnit} />
      <input type="hidden" name="delivery_format" value={deliveryFormat} />
      <input type="hidden" name="language" value={language} />
      <input
        type="hidden"
        name="has_certificate"
        value={hasCertificate ? "true" : "false"}
      />
      <input
        type="hidden"
        name="detailed_description"
        value={detailedDescriptionHtml}
      />
      <input
        type="hidden"
        name="promotional_images"
        value={JSON.stringify(promotionalImages)}
      />

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Название и адрес курса</h3>
          <p className="text-muted-foreground text-sm">
            Заголовок курса и URL для страниц в личном кабинете и каталоге.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-edit-title">Название</Label>
            <Input
              id="course-edit-title"
              name="title"
              required
              maxLength={200}
              defaultValue={course.title}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL курса (slug)</Label>
            <Input
              id="slug"
              name="slug"
              required
              maxLength={120}
              defaultValue={course.slug}
              disabled={isPending}
              placeholder="english-for-beginners"
            />
            <p className="text-xs text-destructive">
              Внимание: изменение URL сделает старые ссылки на курс
              недействительными.
            </p>
          </div>
        </div>
      </div>

      <Accordion
        type="multiple"
        defaultValue={["basic", "media", "landing", "audience", "catalog", "schedule"]}
        className="w-full"
      >
        <AccordionItem value="basic">
          <AccordionTrigger className="text-base font-medium">
            Основная информация
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Карточка курса</h3>
                <p className="text-muted-foreground text-sm">
                  Основная информация, цена и статус публикации.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="course-edit-category">Категория</Label>
                  <Input
                    id="course-edit-category"
                    name="category"
                    maxLength={120}
                    placeholder="Например, Английский язык"
                    defaultValue={course.category ?? ""}
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-edit-description">
                    Краткое описание
                  </Label>
                  <Textarea
                    id="course-edit-description"
                    name="description"
                    rows={4}
                    defaultValue={course.description ?? ""}
                    placeholder="Кратко о содержании курса"
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-edit-price">Цена</Label>
                  <Input
                    id="course-edit-price"
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={Number(course.price)}
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-edit-status">Статус</Label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as CourseSettingsFormCourse["status"])
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="course-edit-status" className="w-full">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Черновик</SelectItem>
                      <SelectItem value="published">Опубликован</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="media">
          <AccordionTrigger className="text-base font-medium">
            Медиа
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Медиа и внешние ссылки</h3>
                <p className="text-muted-foreground text-sm">
                  Обложка, видео и ссылки на внешние площадки.
                </p>
              </div>
              <CourseImageUpload
                courseId={course.id}
                initialImageUrl={course.image_url}
              />
              <CourseVideoUpload
                courseId={course.id}
                initialVideoUrl={course.video_url}
              />
              <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold">Внешние площадки</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="course-youtube">Ссылка YouTube</Label>
                  <Input
                    id="course-youtube"
                    name="youtube_url"
                    type="url"
                    placeholder="https://www.youtube.com/…"
                    defaultValue={course.youtube_url ?? ""}
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-vimeo">Ссылка Vimeo</Label>
                  <Input
                    id="course-vimeo"
                    name="vimeo_url"
                    type="url"
                    placeholder="https://vimeo.com/…"
                    defaultValue={course.vimeo_url ?? ""}
                    disabled={isPending}
                  />
                </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="landing">
          <AccordionTrigger className="text-base font-medium">
            Лендинг
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Контент лендинга</h3>
                <p className="text-muted-foreground text-sm">
                  Текст страницы и галерея изображений.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold">Подробное описание</h4>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-detailed">Текст для страницы курса</Label>
                  <Editor
                    id="course-detailed"
                    value={detailedDescriptionHtml}
                    onChange={setDetailedDescriptionHtml}
                    disabled={isPending}
                  />
                  <p className="text-muted-foreground text-xs">
                    Заголовки, списки и выделение сохраняются как HTML для
                    страницы курса.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold">Галерея лендинга</h4>
                </div>
                <p className="text-muted-foreground text-xs">
                  До 24 изображений. Перед загрузкой файлы сжимаются в браузере
                  (цель до 100 КБ каждый), затем попадают в Storage. Сохраните
                  форму курса, чтобы записать список URL в базу.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    disabled={isPending || galleryBusy}
                    onChange={(ev) => void onGalleryFilesChange(ev)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || galleryBusy || promotionalImages.length >= 24}
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    {galleryBusy ? (
                      <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlusIcon className="mr-2 size-4" aria-hidden />
                    )}
                    Добавить изображения
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    {promotionalImages.length} / 24
                  </span>
                </div>
                {promotionalImages.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {promotionalImages.map((url) => (
                      <li
                        key={url}
                        className="border-border group relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="size-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          className="absolute right-1 top-1 size-7 opacity-90 shadow-sm"
                          disabled={isPending || galleryBusy}
                          aria-label="Убрать из галереи"
                          onClick={() =>
                            setPromotionalImages((prev) =>
                              prev.filter((u) => u !== url),
                            )
                          }
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                    Пока нет изображений — добавьте через кнопку выше.
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audience">
          <AccordionTrigger className="text-base font-medium">
            Целевая аудитория и уровень
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Целевая аудитория и уровень</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="course-audience">Аудитория (лендинг)</Label>
                  <Select
                    value={marketingAudience || "__empty__"}
                    onValueChange={(v) => {
                      const next = v === "__empty__" ? "" : v;
                      setMarketingAudience(next);
                      if (next !== "Дети") setAgeGroup("");
                      if (next !== "Взрослые") setLevel("");
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger id="course-audience" className="w-full">
                      <SelectValue placeholder="Не выбрано" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Не выбрано</SelectItem>
                      <SelectItem value="Дети">Дети</SelectItem>
                      <SelectItem value="Взрослые">Взрослые</SelectItem>
                      <SelectItem value="Все">Все</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {marketingAudience === "Взрослые" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="course-level">Уровень CEFR</Label>
                    <Select
                      value={level || "__empty__"}
                      onValueChange={(v) =>
                        setLevel(v === "__empty__" ? "" : (v as CourseLevel))
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="course-level" className="w-full">
                        <SelectValue placeholder="Выберите уровень" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">Не выбрано</SelectItem>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="A2">A2</SelectItem>
                        <SelectItem value="B1">B1</SelectItem>
                        <SelectItem value="B1+">B1+</SelectItem>
                        <SelectItem value="B2">B2</SelectItem>
                        <SelectItem value="B2+">B2+</SelectItem>
                        <SelectItem value="C1">C1</SelectItem>
                        <SelectItem value="C2">C2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {marketingAudience === "Дети" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="course-age-group">Возрастная группа</Label>
                    <Select
                      value={ageGroup || "__empty__"}
                      onValueChange={(v) =>
                        setAgeGroup(v === "__empty__" ? "" : v)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="course-age-group" className="w-full">
                        <SelectValue placeholder="Выберите группу" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">Не выбрано</SelectItem>
                        {AGE_GROUP_LABELS.map((label) => (
                          <SelectItem key={label} value={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="catalog">
          <AccordionTrigger className="text-base font-medium">
            Витрина и каталог
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Витрина и каталог</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="course-delivery-format">Формат проведения</Label>
                  <Select
                    value={deliveryFormat || "__empty__"}
                    onValueChange={(v) =>
                      setDeliveryFormat(v === "__empty__" ? "" : v)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="course-delivery-format" className="w-full">
                      <SelectValue placeholder="Не выбрано" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Не выбрано</SelectItem>
                      {DELIVERY_FORMAT_LABELS.map((label) => (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-catalog-language">Язык курса</Label>
                  <Select
                    value={language || "__empty__"}
                    onValueChange={(v) =>
                      setLanguage(v === "__empty__" ? "" : v)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="course-catalog-language" className="w-full">
                      <SelectValue placeholder="Не выбрано" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Не выбрано</SelectItem>
                      {COURSE_LANGUAGE_LABELS.map((label) => (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-xs">
                  Эти поля используются на главной странице для фильтров каталога.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="schedule">
          <AccordionTrigger className="text-base font-medium">
            Расписание и длительность
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Расписание и длительность</h3>
              </div>
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
                <div className="grid gap-2">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-muted-foreground text-sm" role="status">
          Изменения сохранены.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>
    </Form>
  );
}
