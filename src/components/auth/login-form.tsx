"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  /** Куда перейти после успешного входа (например /test/uuid из ?next=). */
  redirectTo?: string;
  initialError?: string;
};

export function LoginForm({
  redirectTo = "/dashboard",
  initialError,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setPending(false);

    if (signError) {
      setError(signError.message);
      return;
    }

    router.refresh();
    router.push(redirectTo);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Добро пожаловать
        </h1>
        <p className="text-sm text-slate-500">
          Рады видеть вас. Пожалуйста, авторизуйтесь.
        </p>
      </div>

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
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Входим…" : "Войти"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}
