import type { ReactNode } from "react";

import {
  PublicCourseCard,
  type PublicCourseCardModel,
} from "@/components/public/public-course-card";

export type PublishedCourseCard = PublicCourseCardModel;

type PublishedCoursesStorefrontProps = {
  courses: PublishedCourseCard[];
  /** Активные фильтры в URL и ноль курсов в выборке. */
  filtersYieldEmpty?: boolean;
  /** Горизонтальная панель фильтров над сеткой курсов. */
  toolbar?: ReactNode;
};

export function PublishedCoursesStorefront({
  courses,
  filtersYieldEmpty = false,
  toolbar,
}: PublishedCoursesStorefrontProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-none lg:text-left">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Каталог курсов
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          Выберите программу и перейдите на страницу курса, чтобы узнать
          подробности и программу занятий.
        </p>
      </div>

      {toolbar ? <div className="mt-8">{toolbar}</div> : null}

      {courses.length === 0 ? (
        <p className="text-muted-foreground mx-auto mt-16 max-w-md text-center text-base lg:mx-0 lg:text-left">
          {filtersYieldEmpty
            ? "По выбранным фильтрам курсов нет. Попробуйте изменить условия или сбросить фильтры."
            : "Курсы пока не добавлены. Загляните позже!"}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <PublicCourseCard course={course} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
