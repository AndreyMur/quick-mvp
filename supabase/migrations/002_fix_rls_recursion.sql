-- =====================================================
-- MVP Calculator — Fix: Infinite recursion in profiles RLS
-- =====================================================
-- Запустите этот SQL в SQL Editor вашего Supabase проекта.
-- Эта миграция исправляет бесконечную рекурсию в RLS политиках таблицы profiles.
-- =====================================================

-- Удаляем старые рекурсивные политики
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Создаём SECURITY DEFINER функцию для проверки админа
-- Эта функция выполняется с правами суперпользователя и обходит RLS
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Политика просмотра: свой профиль ИЛИ если админ — все
CREATE POLICY "Users view own or admin all"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_current_user_admin()
  );

-- Политика обновления: свой профиль ИЛИ если админ — все
CREATE POLICY "Users update own or admin all"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR public.is_current_user_admin()
  );

-- Политика удаления: админ может удалять профили
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    public.is_current_user_admin()
  );

-- Для INSERT (создание профиля при регистрации)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Исправляем рекурсивные политики в других таблицах
-- projects
DROP POLICY IF EXISTS "Admins can access all projects" ON projects;
CREATE POLICY "Admins can access all projects"
  ON projects FOR ALL
  USING (
    auth.uid() = user_id
    OR public.is_current_user_admin()
  );

-- custom_services
DROP POLICY IF EXISTS "Users can CRUD own custom services" ON custom_services;
CREATE POLICY "Users can CRUD own custom services"
  ON custom_services FOR ALL
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR public.is_current_user_admin()
  );
