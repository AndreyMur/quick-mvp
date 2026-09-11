-- =====================================================
-- MVP Calculator — Payment events (Phase 22, #66)
-- =====================================================
-- Запустите этот SQL в SQL Editor вашего Supabase проекта.
-- Журнал обработанных событий платёжного провайдера. Уникальность пары
-- (provider, event_id) обеспечивает идемпотентность: повторная доставка
-- одного и того же webhook не применяет переход состояния подписки дважды.
-- Запись выполняет только webhook-обработчик через service-role (RLS обойдён);
-- читать журнал может администратор.
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  type text,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_id_key UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_user_id_idx
  ON payment_events (user_id);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can access payment events" ON payment_events;
CREATE POLICY "Admins can access payment events"
  ON payment_events FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
