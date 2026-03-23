import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Клиент для Server Components, Server Actions и Route Handlers.
 * Обновление сессии по refresh token выполняется в `middleware` (`updateSession`);
 * здесь `setAll` в read-only контексте может бросать — это ожидаемо.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component — set недоступен; сессия обновляется в middleware */
          }
        },
      },
    },
  );
}
