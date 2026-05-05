"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  joinCohortByPin,
  type JoinCohortByPinState,
} from "@/app/actions/enrollment-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: JoinCohortByPinState = {};

export function JoinCohortForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState(
    joinCohortByPin,
    initialState,
  );
  const lastErrorToast = useRef<string | undefined>(undefined);
  const successHandled = useRef(false);

  useEffect(() => {
    successHandled.current = false;
    lastErrorToast.current = undefined;
  }, [pin]);

  useEffect(() => {
    if (!state.error) return;
    if (lastErrorToast.current === state.error) return;
    lastErrorToast.current = state.error;
    toast.error(state.error);
  }, [state.error]);

  useEffect(() => {
    if (!state.success || !state.redirectUrl) return;
    if (successHandled.current) return;
    successHandled.current = true;
    toast.success("Вы записаны на курс. Переход к обучению…");
    router.push(state.redirectUrl);
  }, [state.success, state.redirectUrl, router]);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Присоединиться к группе</CardTitle>
        <CardDescription>
          Введите шестизначный PIN, который выдал преподаватель. После проверки
          вы попадёте в курс в разделе «Обучение».
        </CardDescription>
      </CardHeader>
      <Form action={formAction} className="flex flex-col">
        <CardContent className="space-y-4">
          {state.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="cohort-pin">PIN группы</Label>
            <Input
              id="cohort-pin"
              name="pin"
              value={pin}
              onChange={(e) => {
                const next = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 6);
                setPin(next);
              }}
              placeholder="Например, X7B9QA"
              autoComplete="off"
              inputMode="text"
              maxLength={6}
              className="font-mono tracking-widest"
              disabled={isPending}
              aria-invalid={Boolean(state.error)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending || pin.length < 6}>
            {isPending ? "Проверка…" : "Войти по PIN"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
