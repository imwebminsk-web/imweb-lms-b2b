import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getTestDraftForEdit } from "@/app/actions/test-actions";
import { CreateTestForm } from "@/components/admin/create-test-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { verifyAccess } from "@/lib/auth/rbac";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Редактирование теста",
  description: "Изменение вопросов и настроек теста",
};

export default async function DashboardTestEditPage({ params }: PageProps) {
  const { id } = await params;
  await verifyAccess(["admin", "head_teacher", "teacher"]);

  const draft = await getTestDraftForEdit(id);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/tests"
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "text-muted-foreground",
          )}
        >
          Назад к списку
        </Link>
      </div>

      {!draft.success ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Не удалось открыть черновик</CardTitle>
            <CardDescription className="text-destructive">
              {draft.error}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <CreateTestForm
          testId={draft.data.id}
          initialData={draft.data.initialData}
        />
      )}
    </div>
  );
}
