/**
 * Live RLS verification for the subscriptions and payment_events tables
 * (phase 21, #62; phase 24, #74).
 *
 * Requires the `003_subscriptions.sql` and `004_payment_events.sql`
 * migrations to be applied and the following environment variables (loaded
 * from `.env.local`):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with:
 *   node --env-file=.env.local scripts/verify-subscription-rls.mjs
 *
 * It creates two temporary users (a regular user and an administrator),
 * gives each a subscription and seeds one payment event, then signs in as each
 * of them and checks that:
 *   - the user sees only their own subscription and no payment events;
 *   - the administrator sees every subscription and the payment event.
 * Temporary users and the seeded event are removed afterwards.
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
let eventId;

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

  // Service role bypasses RLS: seed one payment event owned by the user.
  eventId = `evt_rls_${stamp}`;
  const { error: eventSeedError } = await admin.from("payment_events").insert({
    provider: "stripe",
    event_id: eventId,
    type: "checkout.session.completed",
    user_id: user.id,
  });
  if (eventSeedError) throw eventSeedError;

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

  // payment_events: regular users have no read policy, admins see everything.
  const { data: userEvents, error: userEventsError } = await userClient
    .from("payment_events")
    .select("event_id");
  if (userEventsError) throw userEventsError;

  if (userEvents.length !== 0) {
    throw new Error(
      `RLS: пользователь не должен видеть журнал платежей, видит ${userEvents.length}`
    );
  }

  const { data: adminEvents, error: adminEventsError } = await adminClient
    .from("payment_events")
    .select("event_id");
  if (adminEventsError) throw adminEventsError;

  if (!adminEvents.some((row) => row.event_id === eventId)) {
    throw new Error("RLS: администратор должен видеть журнал платежей");
  }

  console.log(
    "OK: RLS подписки и журнала платежей — пользователь видит только свою запись и не видит событий, администратор — все"
  );
} catch (error) {
  console.error("FAIL:", error.message ?? error);
  process.exitCode = 1;
} finally {
  if (eventId) {
    try {
      await admin.from("payment_events").delete().eq("event_id", eventId);
    } catch {
      // Таблица могла не примениться — это не должно скрывать результат проверки.
    }
  }
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {});
  if (adminUser) await admin.auth.admin.deleteUser(adminUser.id).catch(() => {});
}
