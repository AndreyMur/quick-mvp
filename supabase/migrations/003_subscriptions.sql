-- =====================================================
-- MVP Calculator — Subscriptions (Phase 21, #62)
-- =====================================================
-- Запустите этот SQL в SQL Editor вашего Supabase проекта.
-- Создаёт объект данных подписки: план, статус, период и идентификатор
-- провайдера. Пользователь видит только свою запись, администратор — все.
-- =====================================================

-- 1. subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'pro', 'business')),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid'
    )
  )
);

-- Быстрый поиск подписки по идентификатору у платёжного провайдера
-- (используется webhook-обработчиком в фазе 2).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_key
  ON subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- Обновление updated_at автоматически
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS: пользователь — только своя запись, администратор — все
-- =====================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscription" ON subscriptions;
CREATE POLICY "Users view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can access all subscriptions" ON subscriptions;
CREATE POLICY "Admins can access all subscriptions"
  ON subscriptions FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- =====================================================
-- Бэкфилл: у каждого существующего профиля появляется подписка
-- =====================================================
INSERT INTO subscriptions (user_id, plan, status)
SELECT
  id,
  CASE
    WHEN subscription_tier IN ('free', 'pro', 'business') THEN subscription_tier
    ELSE 'free'
  END,
  'active'
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- Новым пользователям сразу создаётся бесплатная подписка
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin, subscription_tier, project_limit, custom_services_limit)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    false,
    'free',
    3,
    2
  );

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
