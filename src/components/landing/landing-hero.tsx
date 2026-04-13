import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHero() {
  return (
    <section className="border-border/40 bg-muted/20 border-b">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <div className="bg-muted relative order-2 aspect-[4/3] w-full overflow-hidden rounded-2xl border lg:order-1">
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium">
            Учебный центр в Минске — New Education
          </div>
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <Badge
            variant="secondary"
            className="w-fit border-amber-500/40 bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100"
          >
            Английский БЕЗ ДОМАШКИ — новинка!
          </Badge>
          <h1 className="text-foreground text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Учиться — легко, если с удовольствием!
          </h1>
          <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
            Разговорные курсы иностранных языков в Минске. Оксфордская методика,
            малые группы и результат уже после первого месяца.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#course-catalog"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Начать учиться
            </Link>
            <Link
              href="#teachers"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Наши преподаватели
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
