import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Новый пароль",
  description: "Установка нового пароля после восстановления",
};

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
