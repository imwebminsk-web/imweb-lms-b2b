"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinCohortByPin } from "@/app/actions/enrollment-actions";
import { useLanguage } from "@/components/providers/language-provider";
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

export function JoinCohortForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const res = await joinCohortByPin(pin);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      if (res.redirectUrl === "/dashboard") {
        toast.success("Заявка отправлена. Ожидайте одобрения преподавателя.");
      } else {
        toast.success(t("dashboard.enrollSuccess"));
      }
      router.push(res.redirectUrl);
    });
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>{t("dashboard.joinGroup")}</CardTitle>
        <CardDescription>{t("dashboard.joinGroupDescription")}</CardDescription>
      </CardHeader>
      <Form onSubmit={handleSubmit} className="flex flex-col">
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cohort-pin">{t("dashboard.groupPin")}</Label>
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
              placeholder={t("dashboard.pinPlaceholder")}
              autoComplete="off"
              inputMode="text"
              maxLength={6}
              className="font-mono tracking-widest"
              disabled={isPending}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending || pin.length < 6}>
            {isPending ? t("dashboard.verifying") : t("dashboard.joinWithPin")}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
