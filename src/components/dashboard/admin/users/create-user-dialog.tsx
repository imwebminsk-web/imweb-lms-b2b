"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Eye, EyeOff, UserPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createUserByAdmin } from "@/app/actions/admin-users-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CREATE_USER_ROLES,
  createUserSchema,
  type CreateUserPayload,
} from "@/lib/validations/admin-user-schema";
import { getRoleTranslation } from "@/lib/utils/role-utils";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*";
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;

function generateSecurePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  const chars = [
    UPPER[bytes[0]! % UPPER.length]!,
    LOWER[bytes[1]! % LOWER.length]!,
    DIGITS[bytes[2]! % DIGITS.length]!,
    SYMBOLS[bytes[3]! % SYMBOLS.length]!,
  ];

  for (let i = 4; i < length; i += 1) {
    chars.push(ALL_CHARS[bytes[i]! % ALL_CHARS.length]!);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i]! % (i + 1);
    const current = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = current;
  }

  return chars.join("");
}

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserPayload>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "student",
      password: "",
    },
  });

  const passwordValue = watch("password");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
      setShowPassword(true);
    }
  }

  function handleGeneratePassword() {
    const generated = generateSecurePassword(12);
    setValue("password", generated, { shouldValidate: true, shouldDirty: true });
    setShowPassword(true);
  }

  async function handleCopyPassword() {
    const password = passwordValue.trim();
    if (!password) {
      toast.error("Сначала введите или сгенерируйте пароль.");
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Пароль скопирован");
    } catch {
      toast.error("Не удалось скопировать пароль");
    }
  }

  async function onSubmit(values: CreateUserPayload) {
    const result = await createUserByAdmin(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Пользователь создан");
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" className="shrink-0">
          <UserPlus className="size-4" aria-hidden />
          Добавить пользователя
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
            <DialogDescription>
              Аккаунт сразу будет подтверждён. Скопируйте пароль до сохранения —
              потом его нельзя будет посмотреть.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-user-name">Имя и фамилия</Label>
              <Input
                id="create-user-name"
                autoComplete="name"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.fullName)}
                {...register("fullName")}
              />
              {errors.fullName?.message ? (
                <p className="text-destructive text-sm" role="alert">
                  {errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-email">Email</Label>
              <Input
                id="create-user-email"
                type="email"
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email?.message ? (
                <p className="text-destructive text-sm" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-role">Роль</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="create-user-role" className="w-full">
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATE_USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleTranslation(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role?.message ? (
                <p className="text-destructive text-sm" role="alert">
                  {errors.role.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-password">Пароль</Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    id="create-user-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-9"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.password)}
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? "Скрыть пароль" : "Показать пароль"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                  disabled={isSubmitting}
                >
                  Сгенерировать
                </Button>
              </div>
              {errors.password?.message ? (
                <p className="text-destructive text-sm" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => void handleCopyPassword()}
                disabled={isSubmitting || !passwordValue}
              >
                <Copy className="size-4" aria-hidden />
                Скопировать пароль
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
