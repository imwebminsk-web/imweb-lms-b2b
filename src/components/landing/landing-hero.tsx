import Image from "next/image";

import { HelpDialog } from "@/components/landing/help-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primaryCtaClassName =
  "bg-[#001352] text-white hover:bg-[#0a1d5d]";

export function LandingHero() {
  return (
    <section className="border-border/40 bg-muted/20 border-b">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <div className="bg-muted order-2 w-full overflow-hidden rounded-2xl border lg:order-1">
          <Image
            src="/glavnay.jpg"
            alt="Главная"
            width={1200}
            height={800}
            className="h-auto w-full object-cover"
            priority
          />
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <Badge
            variant="secondary"
            className="w-fit border-pink-200 bg-pink-100 text-pink-700 dark:border-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
          >
            Английский БЕЗ ДОМАШКИ — новинка!
          </Badge>
          <h1 className="text-[#001352] dark:text-white text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Учиться — легко, если с удовольствием!
          </h1>
          <p className="text-[#001352] dark:text-white/90 max-w-lg text-lg leading-relaxed">
            Разговорные курсы иностранных языков в Минске. Оксфордская
            коммуникативная методика, малые группы и результат уже после
            первого месяца.
          </p>
          <div className="flex flex-wrap gap-3">
            <HelpDialog
              className={cn(
                buttonVariants({ size: "lg" }),
                primaryCtaClassName,
              )}
            >
              Помогите с выбором
            </HelpDialog>
          </div>
        </div>
      </div>
    </section>
  );
}
