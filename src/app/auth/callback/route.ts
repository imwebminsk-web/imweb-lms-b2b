import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  let next = searchParams.get("next") ?? "/update-password";
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/update-password";
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?error=invalid_recovery_link`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/?error=invalid_recovery_link`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
