"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  "Английский",
  "Французский",
  "Немецкий",
  "Испанский",
  "Итальянский",
  "Китайский",
  "Японский",
] as const;

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
] as const;

const AGE_GROUPS = [
  "5–6 лет",
  "6–8 лет",
  "9–13 лет",
  "13–17 лет",
] as const;

const PLACEHOLDER_COURSES = [
  { id: "1", title: "Курс английского языка", tag: "Без домашки" },
  { id: "2", title: "Курс французского языка", tag: "Новинка" },
  { id: "3", title: "Курс немецкого языка", tag: "" },
  { id: "4", title: "Курс испанского языка", tag: "Популярный" },
  { id: "5", title: "Курс для детей", tag: "Детям" },
  { id: "6", title: "Курс к экзаменам", tag: "" },
] as const;

export function LandingCourseCatalog() {
  const [audience, setAudience] = useState<"adults" | "kids">("adults");
  const [language, setLanguage] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);

  function handleAudienceChange(next: string | number | null) {
    const v = String(next);
    if (v !== "adults" && v !== "kids") return;
    setAudience(v);
    setLevel(null);
    setAgeGroup(null);
  }

  return (
    <section
      id="course-catalog"
      className="scroll-mt-20 border-b py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Наши курсы
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Найди программу в центре New Education (Минск): разговорные курсы,
            оксфордская методика и малые группы.
          </p>
        </div>

        <div className="mt-10">
          <Tabs
            value={audience}
            onValueChange={handleAudienceChange}
            className="w-full"
          >
            <TabsList className="mx-auto mb-8 w-full max-w-md">
              <TabsTrigger value="adults" className="flex-1">
                Для взрослых
              </TabsTrigger>
              <TabsTrigger value="kids" className="flex-1">
                Для детей
              </TabsTrigger>
            </TabsList>

            <TabsContent value="adults" className="outline-none">
              <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lang-adults">
                    Язык
                  </label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v)}
                  >
                    <SelectTrigger
                      id="lang-adults"
                      className="w-full min-w-0"
                      size="default"
                    >
                      <SelectValue placeholder="Выбрать язык" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="level-adults">
                    Уровень
                  </label>
                  <Select value={level} onValueChange={(v) => setLevel(v)}>
                    <SelectTrigger
                      id="level-adults"
                      className="w-full min-w-0"
                      size="default"
                    >
                      <SelectValue placeholder="Уровень владения" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((lv) => (
                        <SelectItem key={lv} value={lv}>
                          {lv}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kids" className="outline-none">
              <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lang-kids">
                    Язык
                  </label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v)}
                  >
                    <SelectTrigger
                      id="lang-kids"
                      className="w-full min-w-0"
                      size="default"
                    >
                      <SelectValue placeholder="Выбрать язык" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="age-kids">
                    Возраст
                  </label>
                  <Select
                    value={ageGroup}
                    onValueChange={(v) => setAgeGroup(v)}
                  >
                    <SelectTrigger
                      id="age-kids"
                      className="w-full min-w-0"
                      size="default"
                    >
                      <SelectValue placeholder="Возрастная группа" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUPS.map((age) => (
                        <SelectItem key={age} value={age}>
                          {age}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDER_COURSES.map((course) => (
            <li key={course.id}>
              <Card className="flex h-full flex-col overflow-hidden pt-0 transition-shadow hover:shadow-md">
                <div className="bg-muted aspect-video w-full border-b" />
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-snug">
                      {course.title}
                    </CardTitle>
                    {course.tag ? (
                      <Badge variant="secondary">{course.tag}</Badge>
                    ) : null}
                  </div>
                  <CardDescription>
                    Уточняйте расписание и набор по телефону или на сайте
                    new-edu.by.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1" />
                <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground text-xs">
                    {audience === "adults"
                      ? `Фильтры: ${language ?? "—"} · ${level ?? "—"}`
                      : `Фильтры: ${language ?? "—"} · ${ageGroup ?? "—"}`}
                  </span>
                  <Link
                    href="#course-catalog"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full sm:w-auto",
                    )}
                  >
                    Узнать подробнее
                  </Link>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
