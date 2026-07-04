"use client";

import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const REVIEW_IMAGES = [
  "/review-8.jpg",
  "/review-9.jpg",
  "/review-10.jpg",
  "/review-11.jpg",
  "/review-12.jpg",
  "/review-13.jpg",
  "/review-14.jpg",
] as const;

export function ReviewsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -600 : 600,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex flex-col">
      <div
        ref={scrollRef}
        className="mt-12 flex min-h-0 snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label="Слайдер отзывов учеников"
      >
        {REVIEW_IMAGES.map((src) => (
          <div
            key={src}
            className="h-auto min-h-0 w-full shrink-0 snap-center md:w-[calc(50%-1rem)] lg:w-[calc(50%-1rem)]"
          >
            <Image
              src={src}
              alt="Отзыв ученика"
              width={600}
              height={400}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="h-auto w-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Предыдущие отзывы"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#001352] text-[#001352] transition-colors hover:bg-[#e3efff]"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Следующие отзывы"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#001352] text-[#001352] transition-colors hover:bg-[#e3efff]"
        >
          <ChevronRight className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
