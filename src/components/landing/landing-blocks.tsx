import Link from "next/link";
import { Facebook, Globe, Instagram, MapPin, Phone } from "lucide-react";

import { ReviewsCarousel } from "@/components/landing/reviews-carousel";
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
    title: "Оксфордская коммуникативная методика",
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

export function LandingBenefits() {
  return (
    <section className="bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Почему New Education
        </h2>
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {BENEFITS.map((item) => (
            <li key={item.title}>
              <Card className="text-[#001352] dark:text-white h-full border-none bg-transparent shadow-none">
                <CardHeader className="gap-3">
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                <CardDescription className="text-[#001352] dark:text-white text-base leading-relaxed">
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
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Наши преподаватели
        </h2>
        <p className="text-[#001352] dark:text-white mx-auto mt-3 max-w-2xl text-center text-lg">
          Профессионалы Учебного центра NEW EDUCATION в Минске - разговорная
          практика и поддержка на каждом занятии.
        </p>
        <div className="text-[#001352] dark:text-white mx-auto mt-10 max-w-4xl">
          <p className="text-[#001352] dark:text-white text-lg">
            В команду NEW EDUCATION входят только высококвалифицированные
            преподаватели, имеющие:
          </p>
          <ul className="text-[#001352] dark:text-white list-disc pl-6 mt-4 space-y-2">
            <li className="text-[#001352] dark:text-white">высшее лингвистическое образование;</li>
            <li className="text-[#001352] dark:text-white">
              опыт работы от 5 лет по преподаваемому курсу;
            </li>
            <li className="text-[#001352] dark:text-white">
              знания и умения работать по международным современным учебным
              материалам и методикам преподавания;
            </li>
            <li className="text-[#001352] dark:text-white">
              предпочтительно наличие сертификата международного образца (CELTA и
              др.);
            </li>
            <li className="text-[#001352] dark:text-white">
              положительный опыт работы с детьми и/или взрослыми в группах и
              индивидуально в формате офлайн, онлайн и гибрид;
            </li>
            <li className="text-[#001352] dark:text-white">
              положительный опыт проведения корпоративных занятий.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function LandingSalesCta() {
  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="bg-[#e3efff] text-[#001352] dark:text-[#001352] mx-auto max-w-6xl rounded-2xl px-6 py-14 text-center shadow-lg sm:px-12">
        <h2 className="text-[#001352] dark:text-[#001352] text-3xl font-bold tracking-tight sm:text-4xl">
          Первое занятие — бесплатно
        </h2>
        <p className="text-[#001352] dark:text-[#001352] mx-auto mt-4 max-w-xl text-lg">
          Запишитесь на пробный урок в Минске: подберём уровень, группу и
          расписание. Звоните или оставьте заявку на сайте new-edu.by.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="tel:+375291187722"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex bg-[#001352] text-white hover:bg-[#001352]/90",
            )}
          >
            +375 29 118-77-22
          </a>
          <a
            href="https://new-edu.by/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "inline-flex border-[#001352] bg-transparent text-[#001352] hover:bg-[#001352]/10",
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
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Отзывы учеников
        </h2>
        <p className="text-[#001352] dark:text-white mt-2 mb-8 text-base sm:text-lg">
          Вот реальные отзывы из разных источников
        </p>
        <ReviewsCarousel />
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="text-[#001352] dark:text-[#001352] border-t bg-white py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-[#001352] text-lg font-bold">New Education</p>
          <p className="text-[#001352] mt-2 text-sm">
            Учебный центр «Новое образование» — разговорные курсы языков в Минске.
          </p>
          <a
            href="https://new-edu.by/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#001352] mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <Globe className="size-4" aria-hidden />
            new-edu.by
          </a>
        </div>
        <div>
          <p className="text-[#001352] text-sm font-semibold">Разделы</p>
          <ul className="text-[#001352] mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="#course-catalog"
                className="text-[#001352] hover:text-[#001352]/80"
              >
                Курсы
              </Link>
            </li>
            <li>
              <Link
                href="#teachers"
                className="text-[#001352] hover:text-[#001352]/80"
              >
                Преподаватели
              </Link>
            </li>
            <li>
              <Link href="#faq" className="text-[#001352] hover:text-[#001352]/80">
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/archive"
                className="text-[#001352] hover:text-[#001352]/80"
              >
                Тесты (архив)
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[#001352] text-sm font-semibold">Контакты</p>
          <ul className="text-[#001352] mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="text-[#001352] mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="text-[#001352]">
                г. Минск, ул. Кальварийская, 25, каб. 320
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="text-[#001352] size-4 shrink-0" aria-hidden />
              <a
                href="tel:+375291187722"
                className="text-[#001352] hover:text-[#001352]/80"
              >
                +375 29 118-77-22
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[#001352] text-sm font-semibold">Мы в сети</p>
          <div className="mt-3 flex gap-3">
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#001352] hover:text-[#001352]/80"
              aria-label="Сайт New Education"
            >
              <Globe className="size-5" />
            </a>
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#001352] hover:text-[#001352]/80"
              aria-label="Facebook"
            >
              <Facebook className="size-5" />
            </a>
            <a
              href="https://new-edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#001352] hover:text-[#001352]/80"
              aria-label="Instagram"
            >
              <Instagram className="size-5" />
            </a>
          </div>
        </div>
      </div>
      <p className="text-[#001352] mt-10 text-center text-xs">
        © 2013-2026 Учебный центр «Новое образование»
      </p>
    </footer>
  );
}
