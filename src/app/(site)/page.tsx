import type { Metadata } from "next";
import { Suspense } from "react";

import {
  LandingBenefits,
  LandingFooter,
  LandingReviews,
  LandingSalesCta,
  LandingTeachers,
} from "@/components/landing/landing-blocks";
import { CatalogFilters } from "@/components/landing/catalog-filters";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { PublishedCoursesStorefront } from "@/components/landing/published-courses-storefront";
import {
  catalogHasActiveFilters,
  parseCatalogFilters,
} from "@/lib/catalog-filter-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New Education — курсы языков в Минске | Новое образование",
  description:
    "Разговорные курсы иностранных языков в Минске. Оксфордская методика, малые группы, гибкая оплата. Первое занятие бесплатно.",
};

function CatalogFiltersFallback() {
  return (
    <aside className="border-border bg-muted/30 w-full shrink-0 animate-pulse rounded-xl border p-4 lg:w-64">
      <div className="bg-muted-foreground/20 mb-4 h-4 w-24 rounded" />
      <div className="bg-muted-foreground/15 h-10 w-full rounded-md" />
    </aside>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseCatalogFilters(sp);
  const hasFilters = catalogHasActiveFilters(filters);

  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select(
      "id, title, slug, image_url, price, marketing_audience, level, age_group, target_audience, delivery_format, language",
    )
    .eq("status", "published");

  if (filters.audience === "Дети") {
    query = query.eq("marketing_audience", "Дети");
  } else if (filters.audience === "Взрослые") {
    query = query.eq("marketing_audience", "Взрослые");
  }

  if (filters.format) {
    query = query.eq("delivery_format", filters.format);
  }
  if (filters.language) {
    query = query.eq("language", filters.language);
  }
  if (filters.audience === "Дети" && filters.age) {
    query = query.eq("age_group", filters.age);
  }
  if (filters.audience === "Взрослые" && filters.level) {
    query = query.eq("level", filters.level);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[Home] published courses", error.message);
  }

  const courses = data ?? [];

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <section
          id="course-catalog"
          className="scroll-mt-20 border-b py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
              <Suspense fallback={<CatalogFiltersFallback />}>
                <CatalogFilters />
              </Suspense>
              <PublishedCoursesStorefront
                courses={courses}
                filtersYieldEmpty={courses.length === 0 && hasFilters}
              />
            </div>
          </div>
        </section>
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
