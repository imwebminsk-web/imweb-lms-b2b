import type { Metadata } from "next";

import {
  LandingBenefits,
  LandingFooter,
  LandingReviews,
  LandingSalesCta,
  LandingTeachers,
} from "@/components/landing/landing-blocks";
import { LandingCourseCatalog } from "@/components/landing/landing-course-catalog";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";

export const metadata: Metadata = {
  title: "New Education — курсы языков в Минске | Новое образование",
  description:
    "Разговорные курсы иностранных языков в Минске. Оксфордская методика, малые группы, гибкая оплата. Первое занятие бесплатно.",
};

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingCourseCatalog />
        <LandingBenefits />
        <LandingTeachers />
        <LandingSalesCta />
        <LandingReviews />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
