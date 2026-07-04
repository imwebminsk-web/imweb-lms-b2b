"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    value: "books",
    q: "Нужно ли покупать учебники?",
    a: "Мы предоставляем все необходимые материалы в электронном или печатном виде.",
  },
  {
    value: "location",
    q: "Где проходят занятия?",
    a: "В современных классах у станций метро Молодёжная, Пл. Якуба Коласа и Академия Наук.",
  },
] as const;

export function LandingFaq() {
  return (
    <section id="faq" className="text-[#001352] dark:text-white scroll-mt-20 bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-[#001352] dark:text-white text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Частые вопросы
        </h2>
        <p className="text-[#001352] dark:text-white/80 mt-3 text-center text-lg">
          Ответы на популярные вопросы — звоните, если нужно уточнить детали
          записи.
        </p>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger className="text-[#001352] dark:text-white">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-300">
                <p className="text-slate-600 dark:text-slate-300">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
