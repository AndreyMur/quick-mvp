import { createClient } from "@supabase/supabase-js";
import { type Database } from "./database.types";

/**
 * Supabase admin client with service_role key.
 * Bypasses RLS — use ONLY in server-side API routes.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
