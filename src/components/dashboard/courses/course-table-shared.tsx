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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  isCurator,
}: {
  creatorName: string | null;
  isCurator: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span>{creatorName?.trim() || "—"}</span>
      {isCurator ? (
        <Badge variant="outline" className="text-[10px] font-medium">
          Куратор
        </Badge>
      ) : null}
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
        <Badge key={tag} variant="secondary" className="text-xs font-normal">
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
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
            <span className="sr-only">Открыть меню</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 min-w-[14rem]">
          <DropdownMenuLabel>Действия</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/courses/${encodeURIComponent(course.slug)}`}
              className="flex cursor-pointer items-center gap-2"
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
