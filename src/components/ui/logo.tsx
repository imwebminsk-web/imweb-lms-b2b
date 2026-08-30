import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Для логотипа above the fold (лендинг, главная). */
  priority?: boolean;
  /** URL из platform_settings.logo_url. Если пусто — запасной файл из public. */
  src?: string | null;
  /** Подпись картинки, обычно organization_name. */
  alt?: string | null;
};

export function Logo({
  className,
  priority = false,
  src,
  alt,
}: LogoProps) {
  const imageSrc = src?.trim() ? src.trim() : "/logo.png";
  const imageAlt = alt?.trim() ? alt.trim() : "Логотип платформы";

  return (
    <Image
      src={imageSrc}
      alt={imageAlt}
      width={330}
      height={84}
      priority={priority}
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
