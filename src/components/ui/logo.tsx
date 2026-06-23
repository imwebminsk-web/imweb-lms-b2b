import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Для логотипа above the fold (лендинг, главная). */
  priority?: boolean;
};

export function Logo({ className, priority = false }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="New Education Logo"
      width={330}
      height={84}
      priority={priority}
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
