"use client";

import { Archive, Edit, MoreHorizontal, UserPlus, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CourseTableCurrentUser } from "@/app/actions/courses";
import { deleteCourse } from "@/app/actions/curriculum-actions";
import { ChangeOwnerModal } from "@/components/dashboard/courses/change-owner-modal";
import { ManageCuratorsModal } from "@/components/dashboard/courses/manage-curators-modal";
import type { Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CourseRowAccess = {
  id: string;
  slug: string;
  teacherId: string;
  creatorName: string | null;
  creatorRole: Role | null;
  isCurator: boolean;
  tags: string[];
};

const TAG_SOFT_COLOR_CLASSES = [
  "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  "border-pink-500/40 bg-pink-500/10 text-pink-800 dark:text-pink-200",
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
] as const;

export function getTagColorClasses(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return TAG_SOFT_COLOR_CLASSES[hash % TAG_SOFT_COLOR_CLASSES.length]!;
}

export function canManageCourse(
  currentUser: CourseTableCurrentUser,
  course: Pick<CourseRowAccess, "teacherId" | "creatorRole">,
): boolean {
  return (
    currentUser.role === "admin" ||
    course.teacherId === currentUser.id ||
    (currentUser.role === "head_teacher" && course.creatorRole === "teacher")
  );
}

export function CreatorCell({
  creatorName,
  creatorEmail,
  creatorAvatarUrl,
  isCurator,
}: {
  creatorName: string | null;
  creatorEmail: string | null;
  creatorAvatarUrl: string | null;
  isCurator: boolean;
}) {
  const displayName =
    creatorName?.trim() ||
    creatorEmail?.split("@")[0]?.trim() ||
    "—";
  const emailLine = creatorEmail?.trim() || "—";

  if (displayName === "—" && emailLine === "—") {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9 shrink-0">
        <AvatarImage
          src={creatorAvatarUrl ?? undefined}
          alt={displayName}
        />
        <AvatarFallback className="text-xs">
          {initialsFromDisplayName(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-foreground">
            {displayName}
          </span>
          {isCurator ? (
            <Badge
              variant="outline"
              className="shrink-0 border-violet-500/40 bg-violet-500/10 text-[10px] font-medium text-violet-800 dark:text-violet-200"
            >
              Куратор
            </Badge>
          ) : null}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {emailLine}
        </span>
      </div>
    </div>
  );
}

export function TagsCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex max-w-64 flex-wrap gap-1 whitespace-normal">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn("text-xs font-normal", getTagColorClasses(tag))}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export function CourseRowActions({
  course,
  currentUser,
}: {
  course: CourseRowAccess;
  currentUser: CourseTableCurrentUser;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCuratorModalOpen, setIsCuratorModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const canManage = canManageCourse(currentUser, course);
  const isAdmin = currentUser.role === "admin";

  function handleArchive() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCourse(course.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Курс перенесен в архив");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            <span className="sr-only">Открыть меню</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Действия</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/courses/${encodeURIComponent(course.slug)}`}
              className="flex items-center gap-2"
            >
              <Edit className="mr-2 h-4 w-4" />
              Редактировать
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem
              onClick={() => {
                setSelectedCourseId(course.id);
                setIsOwnerModalOpen(true);
              }}
            >
              <UserRoundCog className="mr-2 h-4 w-4" />
              Сменить владельца
            </DropdownMenuItem>
          ) : null}
          {canManage ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedCourseId(course.id);
                  setIsCuratorModalOpen(true);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Назначить куратора
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isPending}
                onClick={handleArchive}
              >
                <Archive className="mr-2 h-4 w-4" />
                {isPending ? "Архивирование..." : "В архив"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageCuratorsModal
        courseId={selectedCourseId ?? course.id}
        isOpen={isCuratorModalOpen}
        onClose={() => {
          setIsCuratorModalOpen(false);
          setSelectedCourseId(null);
        }}
      />
      <ChangeOwnerModal
        courseId={selectedCourseId ?? course.id}
        currentOwnerId={course.teacherId}
        isOpen={isOwnerModalOpen}
        onClose={() => {
          setIsOwnerModalOpen(false);
          setSelectedCourseId(null);
        }}
      />
    </>
  );
}
