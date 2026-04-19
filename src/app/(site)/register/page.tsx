import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { WithSiteHeader } from "@/components/site/with-site-header";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создание аккаунта ученика",
};

export default function RegisterPage() {
  return (
    <WithSiteHeader>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <RegisterForm />
      </main>
    </WithSiteHeader>
  );
}
