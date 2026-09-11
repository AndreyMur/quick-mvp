import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * RLS/идемпотентность-контракт миграции журнала платежей (фаза 22, #66).
 */

const migrationPath = fileURLToPath(
  new URL("../supabase/migrations/004_payment_events.sql", import.meta.url)
);

const sql = readFileSync(migrationPath, "utf8");

test("миграция создаёт таблицу payment_events с провайдером и событием", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS payment_events/i);
  assert.match(sql, /\bprovider\b/i);
  assert.match(sql, /\bevent_id\b/i);
  assert.match(sql, /\btype\b/i);
  assert.match(sql, /REFERENCES profiles\(id\) ON DELETE SET NULL/i);
});

test("уникальность (provider, event_id) обеспечивает идемпотентность", () => {
  assert.match(
    sql,
    /UNIQUE \(provider, event_id\)/i
  );
});

test("RLS включён, доступ только администратору", () => {
  assert.match(sql, /ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY/i);
  assert.match(
    sql,
    /CREATE POLICY "Admins can access payment events"[\s\S]*?USING \(public\.is_current_user_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_current_user_admin\(\)\)/i
  );
});
