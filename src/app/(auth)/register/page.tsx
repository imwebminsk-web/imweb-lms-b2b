import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создание аккаунта ученика",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
