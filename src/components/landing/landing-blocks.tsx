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

export { LandingFooter } from "@/components/landing/landing-footer";