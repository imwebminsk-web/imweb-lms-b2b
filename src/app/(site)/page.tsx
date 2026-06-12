import type { Metadata } from "next";
import { Suspense } from "react";

import {
  LandingBenefits,
  LandingFooter,
  LandingReviews,
  LandingSalesCta,
  LandingTeachers,
} from "@/components/landing/landing-blocks";
import {
  CatalogFilters,
  CatalogFiltersFallback,
} from "@/components/landing/catalog-filters";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { PublishedCoursesStorefront } from "@/components/landing/published-courses-storefront";
import {
  catalogHasActiveFilters,
  parseCatalogFilters,
} from "@/lib/catalog-filter-params";
import { taxonomyLabelForValue } from "@/lib/catalog-taxonomies";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type CourseLevel = Database["public"]["Enums"]["course_level"];

export const metadata: Metadata = {
  title: "New Education — курсы языков в Минске | Новое образование",
  description:
    "Разговорные курсы иностранных языков в Минске. Оксфордская методика, малые группы, гибкая оплата. Первое занятие бесплатно.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: taxonomyRows, error: taxonomyError } = await supabase
    .from("taxonomies")
    .select("id, type, label, value, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (taxonomyError) {
    console.error("[Home] taxonomies", taxonomyError.message);
  }

  const taxonomies = taxonomyRows ?? [];
  const filters = parseCatalogFilters(sp, taxonomies);
  const hasFilters = catalogHasActiveFilters(filters);

  let query = supabase
    .from("courses")
    .select(
      "id, title, slug, description, image_url, price, marketing_audience, level, age_group, target_audience, delivery_format, language",
    )
    .eq("status", "published");

  const audienceLabel = taxonomyLabelForValue(
    taxonomies,
    "audience",
    filters.audience,
  );
  if (audienceLabel) {
    query = query.eq("marketing_audience", audienceLabel);
  }

  const formatLabel = taxonomyLabelForValue(
    taxonomies,
    "format",
    filters.format,
  );
  if (formatLabel) {
    query = query.eq("delivery_format", formatLabel);
  }

  const languageLabel = taxonomyLabelForValue(
    taxonomies,
    "language",
    filters.language,
  );
  if (languageLabel) {
    query = query.eq("language", languageLabel);
  }

  if (filters.audience === "children" && filters.age) {
    const ageLabel = taxonomyLabelForValue(taxonomies, "age_group", filters.age);
    if (ageLabel) {
      query = query.eq("age_group", ageLabel);
    }
  }

  if (filters.audience === "adults" && filters.level) {
    const levelLabel = taxonomyLabelForValue(
      taxonomies,
      "cefr_level",
      filters.level,
    );
    if (levelLabel) {
      query = query.eq("level", levelLabel as CourseLevel);
    }
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
            <PublishedCoursesStorefront
              courses={courses}
              filtersYieldEmpty={courses.length === 0 && hasFilters}
              toolbar={
                <Suspense fallback={<CatalogFiltersFallback />}>
                  <CatalogFilters taxonomies={taxonomies} />
                </Suspense>
              }
            />
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
