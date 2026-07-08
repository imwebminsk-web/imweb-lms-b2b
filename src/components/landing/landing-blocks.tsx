import Link from "next/link";
import {
  Facebook,
  Globe,
  Instagram,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";

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

function VkIcon({
  className = "h-5 w-5 scale-125",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.78 17h.66s.2-.02.3-.12c.09-.1.09-.3.09-.3s-.01-.9.4-1.03c.41-.13.94.87 1.5 1.25.42.3.74.23.74.23l1.5-.02s.78-.05.41-.66c-.03-.05-.22-.46-1.13-1.3-.96-.9-.83-.75.33-2.3.71-.95 1-1.52.91-1.77-.08-.24-.57-.18-.57-.18l-1.69.01s-.13-.02-.23.04c-.1.05-.16.18-.16.18s-.27.72-.63 1.34c-.76 1.31-1.06 1.38-1.19 1.29-.31-.2-.23-.8-.23-1.23 0-1.34.2-1.9-.4-2.05-.2-.05-.34-.08-.85-.08-.65-.01-1.2 0-1.5.15-.2.1-.36.32-.26.33.13.02.42.08.57.28.19.25.18.81.18.81s.1 1.57-.24 1.76c-.23.12-.55-.13-1.23-1.31-.35-.6-.61-1.26-.61-1.26s-.05-.12-.14-.19a.64.64 0 0 0-.27-.1l-1.61.01s-.24 0-.33.1c-.08.08-.01.26-.01.26s1.26 2.95 2.69 4.44C9.55 17.16 10.5 17 10.5 17h1.29z" />
    </svg>
  );
}

function OkIcon({
  className = "h-5 w-5 scale-125",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 1.8a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm-2.1 8.7a.9.9 0 0 0-.64 1.54L11.73 16l-2.47 2.46a.9.9 0 1 0 1.27 1.27L13 17.27l2.47 2.46a.9.9 0 1 0 1.27-1.27L14.27 16l2.47-2.46a.9.9 0 0 0-1.27-1.27L13 14.73l-2.47-2.46a.9.9 0 0 0-.63-.27Z" />
    </svg>
  );
}

function WhatsAppIcon({
  className = "h-5 w-5 scale-110",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.11 4.93A9.81 9.81 0 0 0 12.03 2C6.57 2 2.12 6.45 2.12 11.91c0 1.75.46 3.46 1.33 4.97L2 22l5.27-1.38a9.82 9.82 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.84-6.99ZM12.04 20.2h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.25-4.36c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.4 5.83c0 4.54-3.69 8.23-8.24 8.23Zm4.51-6.15c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.65-1.24-1.46-1.39-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.15.16 1.59.1.49-.07 1.47-.6 1.67-1.17.21-.57.21-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function ViberIcon({
  className = "h-5 w-5 scale-110",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c4.96 0 9 3.42 9 7.63 0 2.43-1.37 4.6-3.5 5.99V20a1 1 0 0 1-1.58.82l-2.61-1.9c-.43.06-.87.08-1.31.08-4.96 0-9-3.42-9-7.63S7.04 2 12 2Zm-3.7 4.5c-.2 0-.4.08-.54.23-.56.58-.86 1.31-.86 2.08 0 1.89 1.23 3.68 2.47 4.75 1.25 1.08 2.72 1.91 4.53 1.91.79 0 1.54-.26 2.11-.77.14-.13.23-.32.23-.52 0-.29-.17-.55-.44-.66l-1.63-.67a.7.7 0 0 0-.84.25l-.42.56a.53.53 0 0 1-.56.2c-1.13-.34-2.29-1.45-2.75-2.55a.53.53 0 0 1 .14-.59l.5-.47a.7.7 0 0 0 .18-.75l-.66-1.68a.7.7 0 0 0-.66-.45Zm3.13-.26c-.24-.04-.46.12-.5.36-.04.24.12.46.36.5 1.84.3 3.3 1.76 3.6 3.6.04.22.23.37.43.37h.07a.43.43 0 0 0 .36-.5 5.34 5.34 0 0 0-4.32-4.33Zm.32 1.72a.43.43 0 1 0-.14.85c1.03.17 1.85.99 2.02 2.02.03.21.22.37.43.37h.07a.43.43 0 0 0 .36-.5 3.84 3.84 0 0 0-3.1-3.1Z" />
    </svg>
  );
}

function TelegramIcon({
  className = "h-5 w-5 scale-110",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 3.5c-.2-.16-.47-.21-.72-.13L2.7 10.3c-.35.13-.58.46-.57.84.02.38.28.69.64.79l4.8 1.49 1.87 5.75c.1.32.39.55.73.59h.09c.31 0 .6-.16.76-.43l2.66-4.27 4.42 3.25c.14.1.31.16.48.16.11 0 .22-.02.32-.06.28-.11.48-.36.54-.65l3.02-13.42c.07-.31-.04-.63-.28-.84Zm-2.58 2.26-2.45 10.91-3.93-2.89a.84.84 0 0 0-1.24.27l-2.05 3.3-1.34-4.12 7.67-6.68a.84.84 0 0 0-1.11-1.26l-8.74 7.61-2.6-.81 15.79-6.33Z" />
    </svg>
  );
}

export function LandingBenefits() {
  return (
    <section className="bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Почему NEW EDUCATION
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
              buttonVariants({ size: "lg", variant: "landing" }),
              "inline-flex",
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
              "inline-flex border-landing bg-transparent text-landing hover:bg-landing/10",
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
    <section id="reviews" className="border-t py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Отзывы учеников
        </h2>
        <p className="text-[#001352] dark:text-white mt-2 mb-8 text-base sm:text-lg">
          Вот реальные отзывы из разных источников на Учебный центр NEW EDUCATION:
        </p>
        <ReviewsCarousel />
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t bg-slate-100 py-12 text-sm text-[#001352] dark:bg-slate-900 dark:text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="font-bold text-[#001352] dark:text-white">NEW EDUCATION</p>
          <p className="mt-2 text-[#001352] dark:text-slate-300">
            Учебный центр «Новое образование» — разговорные курсы иностранных языков в Минске
          </p>
          <a
            href="https://new-edu.by/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 font-medium text-[#001352] hover:underline dark:text-slate-300 dark:hover:text-white"
          >
            <Globe className="size-4" aria-hidden />
            new-edu.by
          </a>
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Разделы</p>
          <ul className="mt-3 space-y-2 text-[#001352] dark:text-slate-300">
            <li>
              <Link
                href="#course-catalog"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                Курсы
              </Link>
            </li>
            <li>
              <Link
                href="#teachers"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                Преподаватели
              </Link>
            </li>
            <li>
              <Link
                href="#reviews"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                Отзывы
              </Link>
            </li>
            <li>
              <Link
                href="#faq"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/platform"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                О платформе
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Контакты</p>
          <ul className="mt-3 space-y-3 text-[#001352] dark:text-slate-300">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#001352] dark:text-slate-300" aria-hidden />
              <span>г. Минск, ул. Кальварийская, 25, каб. 320</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-[#001352] dark:text-slate-300" aria-hidden />
              <a
                href="tel:+375291187722"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                +375 29 118-77-22
              </a>
            </li>
            <li>
              <a
                href="https://wa.me/375291187722"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                <WhatsAppIcon />
                <span>WhatsApp</span>
              </a>
            </li>
            <li>
              <a
                href="viber://chat?number=%2B375291187722"
                aria-label="Viber"
                className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                <ViberIcon />
                <span>Viber</span>
              </a>
            </li>
            <li>
              <a
                href="https://t.me/+375291187722"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                <TelegramIcon />
                <span>Telegram</span>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Мы в сети</p>
          <div className="mt-3 flex flex-col gap-3">
            <a
              href="https://ok.ru/newedu"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Одноклассники"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
            >
              <OkIcon />
              <span>Одноклассники</span>
            </a>
            <a
              href="https://vk.com/new_edu_by"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Вконтакте"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
            >
              <VkIcon />
              <span>Вконтакте</span>
            </a>
            <a
              href="https://www.facebook.com/newedutc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
              <span>Facebook</span>
            </a>
            <a
              href="https://x.com/newedu_by"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              aria-label="X (Twitter)"
            >
              <Twitter className="h-5 w-5" />
              <span>X (Twitter)</span>
            </a>
            <a
              href="https://www.instagram.com/new_edu.by/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
              <span>Instagram</span>
            </a>
            <a
              href="https://www.youtube.com/channel/UCuDzA-nMw5rX4J6Z4p-OubQ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              aria-label="YouTube"
            >
              <Youtube className="h-5 w-5" />
              <span>YouTube</span>
            </a>
          </div>
        </div>
      </div>
      <p className="mt-10 text-center text-[#001352] dark:text-slate-400">
        © 2013-2026 Учебный центр «Новое образование»
      </p>
    </footer>
  );
}
