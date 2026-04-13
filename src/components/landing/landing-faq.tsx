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
    <section id="faq" className="scroll-mt-20 bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Частые вопросы
        </h2>
        <p className="text-muted-foreground mt-3 text-center text-lg">
          Ответы на популярные вопросы — звоните, если нужно уточнить детали
          записи.
        </p>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>
                <p>{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
