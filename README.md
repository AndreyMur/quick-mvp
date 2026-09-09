# MVP Calculator

Веб-сервис для расчёта стоимости и сроков создания MVP: пошаговый конструктор с нормативами времени на сервисы, ставками ролей и коэффициентами технологий.

## Стек

- **Next.js 16.2.3** (App Router, RSC) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + UI-компоненты (`components/ui`, на базе Base UI / shadcn-стиля)
- **Supabase**: Auth (email + пароль), PostgreSQL (8 таблиц, RLS), Storage (иконки кастомных сервисов)
- **@supabase/ssr** — клиент для серверных компонентов и middleware
- **Zustand** — состояние конструктора проекта
- **React Hook Form + Zod** — формы и валидация
- **Recharts** — диаграммы на странице результата
- **next-intl** — заготовка локализации (русская локаль в `messages/ru.json`)

Требования: Node.js >= 20.9.0.

## Запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните значения:

```bash
cp .env.example .env.local
```

| Переменная | Обязательная | Описание |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | да | URL вашего Supabase-проекта |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | да | Публичный anon-ключ (используется клиентом и middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | да | Сервисный ключ для админ-эндпоинтов (`lib/supabase/admin.ts`). Хранить только на сервере |

### 3. Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com).
2. Примените миграции из `supabase/migrations/` в порядке нумерации (SQL Editor):
   - `001_initial_schema.sql` — 8 таблиц, RLS-политики, триггеры, начальные данные (ставки, нормативы, коэффициенты).
   - `002_fix_rls_recursion.sql` — исправление рекурсивных RLS-политик.
3. Создайте публичный Storage-бакет `custom-service-icons` (см. комментарий в конце `001_initial_schema.sql`).
4. Регистрация автоматически создаёт профиль в `profiles` через триггер `handle_new_user`. Для доступа в `/admin` выставите пользователю `is_admin = true`.

### 4. Dev-сервер

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск dev-сервера |
| `npm run build` | Продакшен-сборка |
| `npm start` | Запуск продакшен-сборки |
| `npm run lint` | ESLint |
| `npm run check:encoding` | Проверка, что все `.ts/.tsx/.json` с русским текстом в UTF-8 |

## Структура проекта

```
app/
  (auth)/login, (auth)/register   # страницы авторизации
  admin/                          # админ-панель: пользователи, глобальные настройки
  api/                            # API-роуты (см. ниже)
  api-docs/                       # Swagger UI (из lib/openapi.ts)
  dashboard/                      # список проектов пользователя
  pricing/                        # тарифы
  projects/new, projects/[id]/    # конструктор, редактирование и результат
  settings/                       # профиль, ставки, сервисы, коэффициенты
components/
  auth/, builder/, layout/, docs/, ui/   # UI и функциональные компоненты
lib/
  calculate.ts                    # алгоритм расчёта
  supabase/                       # клиенты (client/server/admin) + database.types.ts
  stores/project-builder.ts       # Zustand-состояние конструктора
  types/, validations/            # типы и Zod-схемы
  openapi.ts                      # OpenAPI-спецификация
messages/ru.json                  # русские переводы (next-intl)
supabase/migrations/              # SQL-миграции схемы БД
docs/                             # PRD и планы развития
scripts/check-encoding.mjs        # проверка кодировки
```

### Маршруты

`/`, `/login`, `/register`, `/dashboard`, `/settings`, `/pricing`, `/admin`, `/api-docs`, `/projects/new`, `/projects/[id]/edit`, `/projects/[id]/result`.

### API (App Router Route Handlers)

`/api/user/profile`, `/api/user/limits`, `/api/projects` (+`/[id]`), `/api/custom-services` (+`/upload-icon`), `/api/calculate`, `/api/export/pdf`, `/api/settings/user`, `/api/admin/users`, `/api/admin/settings/global`, `/api/subscription/status`, `/api/technologies/coefficients`, `/api/openapi`.

## База данных

Схема описана в `supabase/migrations/001_initial_schema.sql` и типизирована в `lib/supabase/database.types.ts`. Таблицы (8):

- `profiles` — профили пользователей (роль, тариф, лимиты)
- `projects` — сохранённые проекты
- `global_rates` — ставки ролей по умолчанию
- `global_service_hours` — нормативы часов на сервисы
- `user_rates` — персональные ставки пользователя
- `user_service_hours` — персональные нормативы
- `custom_services` — кастомные сервисы (пользовательские и глобальные)
- `technology_coefficients` — коэффициенты технологий

На всех таблицах включён Row Level Security. После изменения схемы перегенерируйте типы:

```bash
npx supabase gen types typescript --project-id <PROJECT_REF> > lib/supabase/database.types.ts
```

## Документация

- `doc.md` — техническое задание (исходные требования)
- `task-plan.md` — детальный план разработки
- `docs/` — PRD и планы фаз дальнейшего развития (PDF-экспорт, монетизация, ядро расчёта v2, автотесты/CI и др.)
