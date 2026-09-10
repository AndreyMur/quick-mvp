/**
 * Live RLS verification for the subscriptions table (phase 21, #62).
 *
 * Requires the `003_subscriptions.sql` migration to be applied and the
 * following environment variables (loaded from `.env.local`):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with:
 *   node --env-file=.env.local scripts/verify-subscription-rls.mjs
 *
 * It creates two temporary users (a regular user and an administrator),
 * gives each a subscription, then signs in as each of them and checks that:
 *   - the user sees only their own subscription;
 *   - the administrator sees every subscription.
 * Temporary users are removed afterwards.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Нужны NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const stamp = Date.now();
const PASSWORD = "rls-verify-password-123";
const USER_EMAIL = `rls-user-${stamp}@example.com`;
const ADMIN_EMAIL = `rls-admin-${stamp}@example.com`;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function anonClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function signIn(email) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

let user;
let adminUser;

try {
  user = await createUser(USER_EMAIL);
  adminUser = await createUser(ADMIN_EMAIL);

  await admin
    .from("profiles")
    .update({ is_admin: true })
    .eq("id", adminUser.id);

  // Service role bypasses RLS: seed one subscription per user.
  const { error: seedError } = await admin.from("subscriptions").upsert(
    [
      { user_id: user.id, plan: "pro", status: "active" },
      { user_id: adminUser.id, plan: "free", status: "active" },
    ],
    { onConflict: "user_id" }
  );
  if (seedError) throw seedError;

  const userClient = await signIn(USER_EMAIL);
  const { data: userRows, error: userError } = await userClient
    .from("subscriptions")
    .select("user_id");
  if (userError) throw userError;

  if (userRows.length !== 1 || userRows[0].user_id !== user.id) {
    throw new Error(
      `RLS: пользователь должен видеть только свою подписку, видит ${userRows.length}`
    );
  }

  const adminClient = await signIn(ADMIN_EMAIL);
  const { data: adminRows, error: adminError } = await adminClient
    .from("subscriptions")
    .select("user_id");
  if (adminError) throw adminError;

  const ids = new Set(adminRows.map((row) => row.user_id));
  if (!ids.has(user.id) || !ids.has(adminUser.id)) {
    throw new Error(
      `RLS: администратор должен видеть все подписки, видит ${adminRows.length}`
    );
  }

  console.log(
    "OK: RLS подписки — пользователь видит только свою запись, администратор — все"
  );
} catch (error) {
  console.error("FAIL:", error.message ?? error);
  process.exitCode = 1;
} finally {
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {});
  if (adminUser) await admin.auth.admin.deleteUser(adminUser.id).catch(() => {});
}
