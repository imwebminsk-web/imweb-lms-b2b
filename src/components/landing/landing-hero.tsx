import Image from "next/image";

import { Badge } from "@/components/ui/badge";

type LandingHeroProps = {
  platformName: string;
  description: string;
};

export function LandingHero({ platformName, description }: LandingHeroProps) {
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
            {platformName}
          </h1>
          {description ? (
            <p className="text-[#001352] dark:text-white/90 max-w-lg text-lg leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
