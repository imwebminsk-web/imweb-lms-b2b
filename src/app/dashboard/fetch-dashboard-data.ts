import { createClient } from "@/lib/supabase/server";
import type { DashboardSectionCard } from "@/lib/dashboard/section-card";
import {
  type DashboardTableRow,
  dashboardTableRowSchema,
} from "@/lib/dashboard-table-schema";
import type { Database } from "@/types/database.types";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

function uuidToStableNumber(id: string): number {
  const hex = id.replace(/-/g, "").slice(0, 8);
  return parseInt(hex, 16) % 2147483647;
}

function formatPrice(price: string): string {
  const n = Number(price);
  return Number.isFinite(n) ? n.toFixed(2) : price;
}

function courseStatusLabel(
  status: Database["public"]["Enums"]["course_status"],
): "Done" | "In Process" {
  return status === "published" ? "Done" : "In Process";
}

function mapCourseRow(
  row: {
    id: string;
    title: string;
    status: Database["public"]["Enums"]["course_status"];
    level: Database["public"]["Enums"]["course_level"];
    price: string;
    slug: string;
    languages: string[];
    teacher: { full_name: string | null } | { full_name: string | null }[] | null;
  },
): DashboardTableRow {
  const languages =
    row.languages?.length > 0 ? row.languages.join(", ") : String(row.level);
  const teacherRel = row.teacher;
  const teacherName = Array.isArray(teacherRel)
    ? teacherRel[0]?.full_name
    : teacherRel?.full_name;
  return dashboardTableRowSchema.parse({
    id: uuidToStableNumber(row.id),
    header: row.title,
    type: languages,
    status: courseStatusLabel(row.status),
    target: formatPrice(row.price),
    limit: row.slug,
    reviewer: teacherName?.trim() || "—",
  });
}

/** Только данные для UI дашборда (без роли — её знает страница). */
export type DashboardData = {
  tableRows: DashboardTableRow[];
  sectionCards: DashboardSectionCard[];
};

/**
 * Загружает строки таблицы и карточки по роли. Использует cookie-сессию Supabase (RLS).
 * Вызывать только из Server Components / route handlers, не передавать на клиент как action.
 */
export async function fetchDashboardData(
  userId: string,
  role: ProfileRole,
): Promise<DashboardData> {
  const supabase = await createClient();

  if (role === "teacher") {
    const { data: courses, error } = await supabase
      .from("courses")
      .select(
        "id, title, status, level, price, slug, languages, teacher:profiles!courses_teacher_id_fkey ( full_name )",
      )
      .eq("teacher_id", userId)
      .order("title");

    if (error) {
      console.error("[fetchDashboardData] teacher courses", error.message);
    }

    const tableRows = (courses ?? []).map((c) => mapCourseRow(c));

    const published = (courses ?? []).filter((c) => c.status === "published")
      .length;
    const drafts = (courses ?? []).filter((c) => c.status === "draft").length;

    const sectionCards: DashboardSectionCard[] = [
      {
        label: "Мои курсы",
        value: String((courses ?? []).length),
        trendPercent: "100%",
        trendUp: true,
        footerTitle: "Черновики и опубликованные",
        footerHint: "Управляйте контентом в разделе преподавателя",
      },
      {
        label: "Опубликовано",
        value: String(published),
        trendPercent: `${published}`,
        trendUp: published > 0,
        footerTitle: "Доступно студентам",
        footerHint: "Статус published в Supabase",
      },
      {
        label: "Черновики",
        value: String(drafts),
        trendPercent: `${drafts}`,
        trendUp: drafts === 0,
        footerTitle: "Требуют публикации",
        footerHint: "Проверьте перед выпуском",
      },
      {
        label: "Аналитика студентов",
        value: "—",
        trendPercent: "0%",
        trendUp: true,
        footerTitle: "Расширение по PRD",
        footerHint: "Запись на курсы появится в следующих итерациях",
      },
    ];

    return { tableRows, sectionCards };
  }

  if (role === "admin") {
    const { data: courses, error } = await supabase
      .from("courses")
      .select(
        "id, title, status, level, price, slug, languages, teacher:profiles!courses_teacher_id_fkey ( full_name )",
      )
      .order("id", { ascending: false })
      .limit(80);

    if (error) {
      console.error("[fetchDashboardData] admin courses", error.message);
    }

    const tableRows = (courses ?? []).map((c) => mapCourseRow(c));

    const [{ count: studentsCount }, { count: teachersCount }, { count: pub }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "teacher"),
        supabase
          .from("courses")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
      ]);

    const sectionCards: DashboardSectionCard[] = [
      {
        label: "Студенты",
        value: String(studentsCount ?? 0),
        trendPercent: "+0%",
        trendUp: true,
        footerTitle: "Профили со ролью student",
        footerHint: "Источник: public.profiles",
      },
      {
        label: "Преподаватели",
        value: String(teachersCount ?? 0),
        trendPercent: "+0%",
        trendUp: true,
        footerTitle: "Профили teacher",
        footerHint: "Управление доступом через RLS",
      },
      {
        label: "Курсы в каталоге",
        value: String(pub ?? 0),
        trendPercent: `${pub ?? 0}`,
        trendUp: (pub ?? 0) > 0,
        footerTitle: "Опубликованные курсы",
        footerHint: "Транзакции оплат — отдельная таблица в PRD",
      },
      {
        label: "Все курсы (строки)",
        value: String((courses ?? []).length),
        trendPercent: "recent",
        trendUp: true,
        footerTitle: "Последние записи",
        footerHint: "Создания курсов; платежи — когда появится схема",
      },
    ];

    return { tableRows, sectionCards };
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select(
      "id, title, status, level, price, slug, languages, teacher:profiles!courses_teacher_id_fkey ( full_name )",
    )
    .eq("status", "published")
    .order("title")
    .limit(40);

  if (error) {
    console.error("[fetchDashboardData] student catalog", error.message);
  }

  const tableRows = (courses ?? []).map((c) => mapCourseRow(c));

  const sectionCards: DashboardSectionCard[] = [
    {
      label: "Каталог",
      value: String((courses ?? []).length),
      trendPercent: "live",
      trendUp: true,
      footerTitle: "Опубликованные курсы",
      footerHint: "Просмотр и запись — по мере развития продукта",
    },
    {
      label: "Моё обучение",
      value: "0",
      trendPercent: "0%",
      trendUp: true,
      footerTitle: "Прогресс",
      footerHint: "Запись на курсы появится в следующих версиях",
    },
    {
      label: "Уровень",
      value: "—",
      trendPercent: "—",
      trendUp: true,
      footerTitle: "Персональные цели",
      footerHint: "Выберите курс из каталога",
    },
    {
      label: "Поддержка",
      value: "24/7",
      trendPercent: "FAQ",
      trendUp: true,
      footerTitle: "Нужна помощь?",
      footerHint: "Раздел Support в меню",
    },
  ];

  return { tableRows, sectionCards };
}
