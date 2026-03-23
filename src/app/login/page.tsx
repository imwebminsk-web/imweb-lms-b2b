import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход для ученика",
};

function sanitizeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = sanitizeNext(next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <LoginForm redirectTo={redirectTo} />
    </main>
  );
}
