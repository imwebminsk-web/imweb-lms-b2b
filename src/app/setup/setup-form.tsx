"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { setupRootOrganization } from "@/app/actions/setup-actions";
import { isCorporateMode, isSchoolMode } from "@/lib/config/app-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getModeLabel(): string {
  if (isSchoolMode && isCorporateMode) return "Гибридный (all)";
  if (isCorporateMode) return "Корпоративный";
  return "Школьный";
}

export function SetupForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  function handleInitialize(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsError(false);

    startTransition(async () => {
      const result = await setupRootOrganization({ email, password, companyName });

      if (result.error) {
        setIsError(true);
        setMessage(`Ошибка при инициализации: ${result.error}`);
        return;
      }

      setIsError(false);
      setIsSuccess(true);
      setMessage(
        `Успешно: организация «${result.data.name}» создана (slug: ${result.data.slug}). Аккаунт администратора создан.`,
      );
    });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <CardTitle className="text-xl">Настройка платформы</CardTitle>
            <Badge variant="secondary">Режим: {getModeLabel()}</Badge>
          </div>
          <CardDescription>
            Инициализация корневой организации для корпоративного режима.
            Выполняется один раз при развертывании инстанса.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSuccess ? (
            <form onSubmit={handleInitialize} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Название компании</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ООО Ромашка"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email администратора</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль администратора</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                  disabled={isPending}
                />
              </div>

              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={isPending}
              >
                {isPending ? "Инициализация..." : "Инициализировать базу"}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              <Button asChild className="w-full">
                <Link href="/login">Перейти к авторизации</Link>
              </Button>
            </div>
          )}

          {message ? (
            <p
              role="status"
              className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                isError
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
