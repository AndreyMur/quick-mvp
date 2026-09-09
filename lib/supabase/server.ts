import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type Database } from "./database.types";

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
              cookieStore.set(name, value, options)
            );
          } catch {
            // In API routes, cookie setting may fail during response generation.
            // The middleware handles session cookies, so this is safe to ignore.
          }
        },
      },
    }
  );
}
