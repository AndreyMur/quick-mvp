-- =====================================================
-- MVP Calculator — Supabase Database Schema & RLS
-- =====================================================
-- Запустите этот SQL в SQL Editor вашего Supabase проекта.
-- =====================================================

-- 1. profiles (расширение auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  is_admin boolean NOT NULL DEFAULT false,
  subscription_tier text NOT NULL DEFAULT 'free',
  project_limit integer NOT NULL DEFAULT 3,
  custom_services_limit integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. global_rates
CREATE TABLE IF NOT EXISTS global_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  hourly_rate integer NOT NULL DEFAULT 0
);

-- 4. global_service_hours
CREATE TABLE IF NOT EXISTS global_service_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL UNIQUE,
  hours integer NOT NULL DEFAULT 0,
  fixed_cost integer
);

-- 5. user_rates
CREATE TABLE IF NOT EXISTS user_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  hourly_rate integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, role)
);

-- 6. user_service_hours
CREATE TABLE IF NOT EXISTS user_service_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  hours integer NOT NULL DEFAULT 0,
  fixed_cost integer,
  UNIQUE(user_id, service_key)
);

-- 7. custom_services
CREATE TABLE IF NOT EXISTS custom_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  hours integer NOT NULL DEFAULT 0,
  fixed_cost integer,
  icon_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. technology_coefficients
CREATE TABLE IF NOT EXISTS technology_coefficients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technology_key text NOT NULL UNIQUE,
  coefficient float NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- Обновление updated_at автоматически
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technology_coefficients_updated_at
  BEFORE UPDATE ON technology_coefficients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (Row Level Security) политики
-- =====================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can access all projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- user_rates
ALTER TABLE user_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rates"
  ON user_rates FOR ALL
  USING (auth.uid() = user_id);

-- user_service_hours
ALTER TABLE user_service_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own service hours"
  ON user_service_hours FOR ALL
  USING (auth.uid() = user_id);

-- custom_services
ALTER TABLE custom_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own custom services"
  ON custom_services FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can read global custom services"
  ON custom_services FOR SELECT
  USING (user_id IS NULL);

-- global_rates, global_service_hours, technology_coefficients — только чтение для всех
ALTER TABLE global_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read global rates"
  ON global_rates FOR SELECT
  USING (true);

ALTER TABLE global_service_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read global service hours"
  ON global_service_hours FOR SELECT
  USING (true);

ALTER TABLE technology_coefficients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read technology coefficients"
  ON technology_coefficients FOR SELECT
  USING (true);

-- =====================================================
-- Функция создания профиля при регистрации
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Начальные данные: глобальные ставки и коэффициенты
-- =====================================================
INSERT INTO global_rates (role, hourly_rate) VALUES
  ('project_manager', 50),
  ('frontend_developer', 50),
  ('backend_developer', 55),
  ('mobile_developer', 55),
  ('qa_engineer', 40),
  ('devops', 60),
  ('ui_ux_designer', 45)
ON CONFLICT (role) DO NOTHING;

INSERT INTO technology_coefficients (technology_key, coefficient) VALUES
  ('react', 1.0),
  ('vue', 1.1),
  ('angular', 1.2),
  ('node_js', 1.0),
  ('python', 1.05),
  ('ruby', 1.1),
  ('php', 0.9),
  ('postgresql', 1.0),
  ('mysql', 1.05),
  ('mongodb', 1.1),
  ('react_native', 1.05),
  ('flutter', 1.1),
  ('native_ios', 1.3),
  ('native_android', 1.2)
ON CONFLICT (technology_key) DO NOTHING;

INSERT INTO global_service_hours (service_key, hours, fixed_cost) VALUES
  ('authentication', 16, null),
  ('personal_cabinet', 24, null),
  ('payment_system', 20, null),
  ('chat_basic', 12, null),
  ('admin_panel', 16, null),
  ('notifications', 8, null),
  ('file_upload', 8, null),
  ('analytics', 12, null),
  ('social_integration', 6, null),
  ('search', 10, null)
ON CONFLICT (service_key) DO NOTHING;

-- =====================================================
-- Supabase Storage Bucket для иконок кастомных сервисов
-- =====================================================
-- Создаётся через Supabase Dashboard → Storage → New Bucket
-- Имя: custom-service-icons, Public: true
-- Или выполните SQL ниже (требует прав администратора):
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('custom-service-icons', 'custom-service-icons', true);
--
-- Политика публичного чтения:
-- CREATE POLICY "Public Access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'custom-service-icons');
--
-- Политика загрузки для аутентифицированных:
-- CREATE POLICY "Authenticated upload"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'custom-service-icons');
