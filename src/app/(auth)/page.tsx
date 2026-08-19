import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход для ученика",
};

function sanitizeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = sanitizeNext(params.returnTo ?? params.next);

  return <LoginForm redirectTo={redirectTo} />;
}
