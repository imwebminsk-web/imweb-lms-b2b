"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp, type SignUpState } from "@/app/actions/auth-actions";
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
import { PasswordInput } from "@/components/ui/password-input";

const empty: SignUpState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUp, empty);

  return (
    <Card className="w-full max-w-sm border-0 bg-transparent p-0 shadow-none ring-0">
      <div className="mb-2 flex flex-col gap-1 px-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Добро пожаловать
        </h1>
        <p className="text-sm text-slate-500">
          Рады видеть вас. Пожалуйста, авторизуйтесь.
        </p>
      </div>
      <CardHeader className="px-0">
        <CardTitle>Регистрация</CardTitle>
        <CardDescription>
          Укажите почту и пароль. После регистрации вы сразу попадёте в личный
          кабинет.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="space-y-2">
            <Label htmlFor="email">Электронная почта</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ваш@адрес.ru"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          {state.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-0 bg-transparent p-0">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Создаём аккаунт…" : "Зарегистрироваться"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Уже есть аккаунт?{" "}
            <Link
              href="/"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Войти
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
