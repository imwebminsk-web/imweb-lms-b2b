import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing/landing-blocks";
import { ContactFormBlock } from "@/components/landing/contact-form-block";
import { LandingHeader } from "@/components/landing/landing-header";
import { PlatformSlider } from "@/components/landing/platform-slider";

export const metadata: Metadata = {
  title: "Как работает платформа | New Education",
  description:
    "Узнайте, как устроено обучение на платформе New Education: регистрация, теория, практика и обратная связь.",
};

export default function PlatformPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-card text-[#001352] flex flex-1 flex-col">
        <LandingHeader />
        <main className="flex-1">
          <div className="container mx-auto max-w-6xl px-4 py-12">
            <h1 className="mb-2 text-3xl font-bold text-[#001352] dark:text-white sm:text-5xl">
              Как проходит обучение на платформе
            </h1>
            <p className="mb-10 text-lg text-[#001352]/80 dark:text-white/80">
              4 шага к успешным переменам в карьере и жизни
            </p>
            <PlatformSlider />
            <section className="mb-12 mt-16 rounded-3xl bg-[#e3efff]/50 p-8 sm:p-12">
              <ContactFormBlock />
            </section>
          </div>
        </main>
      </div>
      <LandingFooter />
    </div>
  );
}
