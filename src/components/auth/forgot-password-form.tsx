"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { requestPasswordReset } from "@/app/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsPending(true);

    const result = await requestPasswordReset(email);

    setIsPending(false);

    if (!result.ok) {
      toast.error(result.error);
      setError(result.error);
      return;
    }

    toast.success("Ссылка отправлена. Проверьте почту.");
    setIsSubmitted(true);
  }

  return (
    <Card className="w-full max-w-sm border-0 bg-transparent p-0 shadow-none ring-0">
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Добро пожаловать
        </h1>
        <p className="text-sm text-slate-500">
          Рады видеть вас. Пожалуйста, авторизуйтесь.
        </p>
      </div>
      <CardHeader className="px-0">
        <CardTitle>Восстановление пароля</CardTitle>
        <CardDescription>
          Введите email, и мы отправим ссылку для сброса
        </CardDescription>
      </CardHeader>

      {isSubmitted ? (
        <CardContent className="space-y-4 px-0">
          <p className="text-sm text-green-600 dark:text-green-500">
            Ссылка отправлена! Проверьте вашу почту (и папку Спам).
          </p>
          <p className="text-muted-foreground text-center text-sm">
            <Link
              href="/"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Вернуться ко входу
            </Link>
          </p>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="space-y-2">
              <Label htmlFor="email">Электронная почта</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ваш@адрес.ru"
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-0 bg-transparent p-0">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Отправляем…" : "Отправить ссылку"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              <Link
                href="/"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Вернуться ко входу
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
