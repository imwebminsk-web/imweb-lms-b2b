import { z } from "zod";

import type { Database } from "@/types/database.types";

export type CourseLevel = Database["public"]["Enums"]["course_level"];

export const AUDIENCE_LABELS = ["Дети", "Взрослые", "Все"] as const;
export type AudienceLabel = (typeof AUDIENCE_LABELS)[number];

export const AGE_GROUP_LABELS = [
  "5-6 лет",
  "6-8 лет",
  "9-13 лет",
  "13-17 лет",
] as const;
export type AgeGroupLabel = (typeof AGE_GROUP_LABELS)[number];

const LEVELS = [
  "0",
  "A1",
  "A2",
  "B1",
  "B1+",
  "B2",
  "B2+",
  "C1",
  "C2",
] as const satisfies readonly CourseLevel[];

/** Значение аудитории из формы: пусто или одна из меток. */
export const marketingAudienceFormSchema = z.union([
  z.literal(""),
  z.enum(["Дети", "Взрослые", "Все"]),
]);

/** Возрастная группа из формы. */
export const ageGroupFormSchema = z.union([
  z.literal(""),
  z.enum(["5-6 лет", "6-8 лет", "9-13 лет", "13-17 лет"]),
]);

/** CEFR из формы (пусто, если поле не отправлялось). */
export const courseLevelFormSchema = z.union([z.literal(""), z.enum(LEVELS)]);

export const DELIVERY_FORMAT_LABELS = ["Онлайн", "Офлайн", "Гибрид"] as const;
export type DeliveryFormatLabel = (typeof DELIVERY_FORMAT_LABELS)[number];

export const COURSE_LANGUAGE_LABELS = [
  "Английский",
  "Испанский",
  "Французский",
  "Немецкий",
  "Китайский",
  "Русский",
] as const;
export type CourseLanguageLabel = (typeof COURSE_LANGUAGE_LABELS)[number];

export const deliveryFormatFormSchema = z.union([
  z.literal(""),
  z.enum(DELIVERY_FORMAT_LABELS),
]);

export const courseLanguageFormSchema = z.union([
  z.literal(""),
  z.enum(COURSE_LANGUAGE_LABELS),
]);
