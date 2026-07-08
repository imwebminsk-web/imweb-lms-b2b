"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ContactFormBlockProps = {
  className?: string;
};

export function ContactFormBlock({ className }: ContactFormBlockProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 p-4 sm:p-6 md:grid-cols-2 md:gap-8 md:p-8",
        className,
      )}
    >
      <div className="flex h-full flex-col justify-center space-y-4">
        <h2 className="text-2xl font-bold text-[#001352] sm:text-3xl">
          Поможем решить все вопросы
        </h2>
        <p className="text-sm text-[#001352]/80 sm:text-base">
          Если вы хотите больше узнать о NEW EDUCATION или не знаете, какой курс
          выбрать, оставьте заявку - и мы перезвоним.
        </p>
        <div className="mt-6 flex h-[200px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-200/60 sm:mt-8 sm:h-[280px]">
          <span className="font-medium text-slate-400">Место для картинки</span>
        </div>
      </div>

      <form
        className="flex h-full flex-col justify-center space-y-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input type="text" name="name" placeholder="Имя" required />
        <Input type="tel" name="phone" placeholder="Телефон" required />
        <Input type="email" name="email" placeholder="Email" required />
        <Button type="submit" variant="landing" className="w-full">
          Отправить
        </Button>
        <p className="mt-2 text-center text-xs text-[#001352]/60">
          Нажимая на кнопку, я соглашаюсь на{" "}
          <Link href="/privacy-agreement" className="underline hover:text-primary">
            обработку персональных данных
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
