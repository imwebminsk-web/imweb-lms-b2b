import Link from "next/link";
import { Facebook, Globe, Instagram, MapPin, Phone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    title: "Оксфордская методика",
    body: "Учим говорить без зубрежки и скучных учебников.",
  },
  {
    title: "Гибкая оплата",
    body: "Возможность оплаты в 2 этапа (50/50) или помесячно. Первое занятие — бесплатно.",
  },
  {
    title: "Сертификат",
    body: "Выдаем официальный сертификат по окончании каждого уровня (CEFR).",
  },
] as const;

const TEACHERS = [
  { name: "Команда центра", role: "Разговорный английский, малые группы" },
  { name: "Команда центра", role: "Немецкий, французский, испанский" },
  { name: "Команда центра", role: "Подготовка к экзаменам и собеседованиям" },
  { name: "Команда центра", role: "Индивидуальные и корпоративные программы" },
  { name: "Команда центра", role: "Детские и подростковые группы" },
] as const;

const REVIEWS = [
  {
    quote:
      "Оксфордская методика реально работает: говорю свободнее уже через месяц, без зубрёжки правил.",
    author: "Ученик центра",
    role: "Минск",
  },
  {
    quote:
      "Удобная оплата частями и бесплатное первое занятие — сразу поняли, подходит ли группа.",
    author: "Ученик центра",
    role: "Минск",
  },
  {
    quote:
      "Занятия рядом с метро, классы нормальные, преподаватель вовлечённый.",
    author: "Ученик центра",
    role: "Минск",
  },
] as const;

export function LandingBenefits() {
  return (
    <section className="bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Почему New Education
        </h2>
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {BENEFITS.map((item) => (
            <li key={item.title}>
              <Card className="h-full border-none bg-transparent shadow-none">
                <CardHeader className="gap-3">
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {item.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LandingTeachers() {
  return (
    <section id="teachers" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Наши преподаватели
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center text-lg">
          Профессионалы учебного центра «Новое образование» в Минске — разговорная
          практика и поддержка на каждом занятии.
        </p>
        <div className="mt-10 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5">
          {TEACHERS.map((t, i) => (
            <Card
              key={`${t.name}-${i}`}
              className="w-[min(260px,80vw)] shrink-0 snap-center md:w-auto"
            >
              <div className="bg-muted mx-auto mt-6 size-24 rounded-full border" />
              <CardHeader className="text-center">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <CardDescription>{t.role}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingSalesCta() {
  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="bg-primary text-primary-foreground mx-auto max-w-6xl rounded-2xl px-6 py-14 text-center shadow-lg sm:px-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Первое занятие — бесплатно
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg opacity-90">
          Запишитесь на пробный урок в Минске: подберём уровень, группу и
          расписание. Звоните или оставьте заявку на сайте new-edu.by.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="tel:+375447477722"
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "inline-flex",
            )}
          >
            +375 44 74-777-22
          </a>
          <a
            href="https://new-edu.by/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "inline-flex border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10",
            )}
          >
            Сайт new-edu.by
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingReviews() {
  return (
    <section className="border-t py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Отзывы учеников
        </h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((r, i) => (
            <li key={i}>
              <Card className="h-full">
                <CardHeader>
                  <p className="text-foreground text-sm leading-relaxed italic">
                    «{r.quote}»
                  </p>
                  <CardTitle className="text-base">{r.author}</CardTitle>
                  <CardDescription>{r.role}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/20 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold">New Education</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Учебный центр «Новое образование» — разговорные курсы языков в Минске.
          </p>
          <a
            href="https://new-edu.by/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <Globe className="size-4" aria-hidden />
            new-edu.by
          </a>
        </div>
        <div>
          <p className="text-sm font-semibold">Разделы</p>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            <li>
              <Link href="#course-catalog" className="hover:text-foreground">
                Курсы
              </Link>
            </li>
            <li>
              <Link href="#teachers" className="hover:text-foreground">
                Преподаватели
              </Link>
            </li>
            <li>
              <Link href="#faq" className="hover:text-foreground">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/archive" className="hover:text-foreground">
                Тесты (архив)
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Контакты</p>
          <ul className="text-muted-foreground mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>г. Минск, ул. Кальварийская, 25, каб. 320</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden />
              <a href="tel:+375447477722" className="hover:text-foreground">
                +375 44 74-777-22
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden />
              <a href="tel:+375298187722" className="hover:text-foreground">
                +375 29 818-77-22
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Мы в сети</p>
          <div className="mt-3 flex gap-3">
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Сайт New Education"
            >
              <Globe className="size-5" />
            </a>
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Facebook"
            >
              <Facebook className="size-5" />
            </a>
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Instagram"
            >
              <Instagram className="size-5" />
            </a>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-10 text-center text-xs">
        © 2013-2026 Учебный центр «Новое образование»
      </p>
    </footer>
  );
}
