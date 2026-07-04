"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = [
  {
    subtitle: "Регистрация",
    title: "Знакомьтесь с платформой",
    description:
      "Платформа NEW EDUCATION - собственная разработка компании, которую мы постоянно улучшаем. Вас ждут интересные уроки, аудио и видео материалы, практические и тестовые задания. А так же общение с преподавателями в офлайн и гибрид форматах.",
    imageId: 1,
  },
  {
    subtitle: "Теория",
    title: "Получайте знания",
    description:
      "Курсы состоят из теоретического материала, тематических аудио, видео материалов разной длительности. Занимайтесь и смотрите их когда и где угодно. Доступ может быть бессрочным, чтобы вы всегда могли вернуться и повторить теорию.",
    imageId: 2,
  },
  {
    subtitle: "Практика",
    title: "Выполняйте задания",
    description:
      "Полученные теоретические знания отрабатываются на практике. Поэтому после теории вас ждут практические упражнения, интерактивные задания с большим количеством аутентичных аудио и видео материалов.",
    imageId: 3,
  },
  {
    subtitle: "Обратная связь",
    title: "Работайте с преподавателем",
    description:
      "На основе полученной теории и практики вас ждёт выполнение тестов. В зависимости от выбранного вами формата обучения оценивание тестов будет как автоматическое, так и сертифицированными преподавателями. Которые помогут с трудными заданиями и подскажут, как улучшить ваши результаты. Общаться с проверяющими преподавателями можно сразу на платформе.",
    imageId: 4,
  },
] as const;

export function PlatformSlider() {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const step = STEPS[currentStep];

  return (
    <div className="grid min-h-[500px] grid-cols-1 gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 lg:grid-cols-2 lg:gap-12">
      <div className="flex flex-col justify-between">
        <div>
          <span className="mb-4 block font-medium text-slate-500">
            {step.subtitle}
          </span>
          <h3 className="mb-6 text-2xl font-bold text-[#001352] sm:text-3xl">
            {step.title}
          </h3>
          <p className="text-base leading-relaxed text-[#001352]/80 sm:text-lg">
            {step.description}
          </p>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0}
            aria-label="Предыдущий шаг"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 transition-colors hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={currentStep === STEPS.length - 1}
            aria-label="Следующий шаг"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 transition-colors hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex h-[300px] w-full items-center justify-center rounded-xl bg-[#e3efff] lg:h-full">
        <span className="text-6xl font-black text-[#001352]/20">
          {step.imageId}
        </span>
      </div>
    </div>
  );
}
