import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * RLS-контракт миграции подписки (фаза 21, #62).
 *
 * Офлайн-проверка того, что миграция создаёт объект подписки и включает
 * построчный доступ: пользователь — только своя запись, администратор — все.
 * Полноценная проверка RLS на живой БД выполняется скриптом
 * `supabase/tests/subscriptions_rls.sql` (см. README/миграцию).
 */

const migrationPath = fileURLToPath(
  new URL("../supabase/migrations/003_subscriptions.sql", import.meta.url)
);

const sql = readFileSync(migrationPath, "utf8");

test("миграция создаёт таблицу subscriptions с планом, статусом, периодом и провайдером", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS subscriptions/i);
  assert.match(sql, /\bplan\b/i);
  assert.match(sql, /\bstatus\b/i);
  assert.match(sql, /current_period_start/i);
  assert.match(sql, /current_period_end/i);
  assert.match(sql, /provider_subscription_id/i);
  assert.match(sql, /REFERENCES profiles\(id\) ON DELETE CASCADE/i);
});

test("RLS включён для subscriptions", () => {
  assert.match(sql, /ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY/i);
});

test("пользователь видит только свою запись подписки", () => {
  assert.match(
    sql,
    /CREATE POLICY "Users view own subscription"[\s\S]*?USING \(auth\.uid\(\) = user_id\)/i
  );
});

test("администратор имеет доступ ко всем записям подписки", () => {
  assert.match(
    sql,
    /CREATE POLICY "Admins can access all subscriptions"[\s\S]*?USING \(public\.is_current_user_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_current_user_admin\(\)\)/i
  );
});

test("миграция бэкфиллит подписки для существующих профилей", () => {
  assert.match(
    sql,
    /INSERT INTO subscriptions \(user_id, plan, status\)[\s\S]*?FROM profiles/i
  );
});

test("новым пользователям создаётся бесплатная подписка", () => {
  assert.match(
    sql,
    /INSERT INTO public\.subscriptions \(user_id, plan, status\)[\s\S]*?VALUES \(NEW\.id, 'free', 'active'\)/i
  );
});
