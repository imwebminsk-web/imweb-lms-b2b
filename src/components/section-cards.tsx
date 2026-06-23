import {
  BookOpenIcon,
  ClipboardListIcon,
  LayersIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type {
  AdminDashboardMetrics,
  DashboardSectionCard,
  TeacherDashboardMetrics,
} from "@/lib/dashboard/section-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const TEACHER_METRIC_CARDS: {
  key: keyof TeacherDashboardMetrics
  label: string
  description: string
  icon: LucideIcon
}[] = [
  {
    key: "pendingReviews",
    label: "На проверке",
    description: "Ожидают проверки",
    icon: ClipboardListIcon,
  },
  {
    key: "totalStudents",
    label: "Ученики",
    description: "Всего учеников",
    icon: UsersIcon,
  },
  {
    key: "totalCohorts",
    label: "Активные группы",
    description: "Текущие потоки",
    icon: LayersIcon,
  },
  {
    key: "totalCourses",
    label: "Всего курсов",
    description: "Черновики и опубликованные",
    icon: BookOpenIcon,
  },
]

function TeacherMetricCards({ metrics }: { metrics: TeacherDashboardMetrics }) {
  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card md:grid-cols-2 lg:grid-cols-4 lg:px-6">
      {TEACHER_METRIC_CARDS.map(({ key, label, description, icon: Icon }) => (
        <Card key={key} className="@container/card">
          <CardHeader className="relative">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {metrics[key]}
            </CardTitle>
            <div className="absolute right-4 top-4">
              <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg border">
                <Icon className="size-4" aria-hidden />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="text-muted-foreground text-sm">
            {description}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function AdminStatCards({ metrics }: { metrics: AdminDashboardMetrics }) {
  const cards = [
    { label: "Студенты", value: metrics.totalStudents },
    { label: "Преподаватели", value: metrics.totalTeachers },
    { label: "Курсы", value: metrics.totalCourses },
  ] as const;

  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card md:grid-cols-2 lg:grid-cols-3 lg:px-6">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {card.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function DefaultSectionCards({ cards }: { cards: DashboardSectionCard[] }) {
  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card md:grid-cols-2 lg:grid-cols-4 lg:px-6">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader className="relative">
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {card.value}
            </CardTitle>
            <div className="absolute right-4 top-4">
              <Badge
                variant="outline"
                className="flex gap-1 rounded-lg text-xs"
              >
                {card.trendUp ? (
                  <TrendingUpIcon className="size-3" />
                ) : (
                  <TrendingDownIcon className="size-3" />
                )}
                {card.trendPercent}
              </Badge>
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {card.footerTitle}{" "}
              {card.trendUp ? (
                <TrendingUpIcon className="size-4" />
              ) : (
                <TrendingDownIcon className="size-4" />
              )}
            </div>
            <div className="text-muted-foreground">{card.footerHint}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

export function SectionCards({
  cards,
  teacherMetrics,
  adminMetrics,
}: {
  cards: DashboardSectionCard[]
  teacherMetrics?: TeacherDashboardMetrics
  adminMetrics?: AdminDashboardMetrics
}) {
  if (teacherMetrics) {
    return <TeacherMetricCards metrics={teacherMetrics} />
  }

  if (adminMetrics) {
    return <AdminStatCards metrics={adminMetrics} />
  }

  return <DefaultSectionCards cards={cards} />
}
