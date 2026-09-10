import { createClient } from "@supabase/supabase-js";
import { TEST_USER, canUseTestUser } from "./helpers/user";

export default async function globalSetup() {
  if (!canUseTestUser) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: createError } = await admin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });

  if (!createError) return;
  if (!/already|registered|exists/i.test(createError.message)) {
    throw createError;
  }

  const { data, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = data.users.find(
    (user) => user.email?.toLowerCase() === TEST_USER.email.toLowerCase()
  );
  if (!existing) throw createError;

  const { error: updateError } = await admin.auth.admin.updateUserById(
    existing.id,
    { password: TEST_USER.password, email_confirm: true }
  );
  if (updateError) throw updateError;
}
