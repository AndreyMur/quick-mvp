const jsonContent = (schema: Record<string, unknown>, example?: unknown) => ({
  "application/json": {
    schema,
    ...(example !== undefined ? { example } : {}),
  },
});

const errorResponse = (description: string, example: { error: string }) => ({
  description,
  content: jsonContent(
    {
      type: "object",
      properties: {
        error: { type: "string" },
      },
      required: ["error"],
      additionalProperties: true,
    },
    example
  ),
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "MVP Calculator API",
    version: "1.0.0",
    description:
      "Документация по текущему API проекта MVP Calculator. Авторизация описана как cookie-based Supabase session.",
  },
  servers: [
    {
      url: "/",
      description: "Current environment",
    },
  ],
  tags: [
    { name: "Admin", description: "Административные методы" },
    { name: "Projects", description: "Проекты пользователя" },
    { name: "Calculation", description: "Расчёт стоимости и сроков" },
    { name: "Settings", description: "Настройки пользователя" },
    { name: "Custom Services", description: "Кастомные сервисы" },
    { name: "User", description: "Профиль, лимиты и подписка" },
    { name: "Reference", description: "Справочные данные" },
    { name: "Export", description: "Экспорт результата" },
  ],
  components: {
    securitySchemes: {
      SupabaseSessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
        description:
          "Cookie-based Supabase session. На практике middleware и Supabase могут использовать несколько cookie.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      ValidationError: {
        allOf: [
          { $ref: "#/components/schemas/Error" },
          {
            type: "object",
            properties: {
              details: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
        ],
      },
      Profile: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          full_name: { type: ["string", "null"] },
          is_admin: { type: "boolean" },
          subscription_tier: {
            type: "string",
            enum: ["free", "pro", "business"],
          },
          project_limit: { type: "integer" },
          custom_services_limit: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "email",
          "is_admin",
          "subscription_tier",
          "project_limit",
          "custom_services_limit",
          "created_at",
          "updated_at",
        ],
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          data: {
            oneOf: [
              { $ref: "#/components/schemas/ProjectData" },
              { type: "null" },
            ],
          },
          status: {
            type: "string",
            enum: ["draft", "completed"],
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "user_id",
          "name",
          "description",
          "data",
          "status",
          "created_at",
          "updated_at",
        ],
      },
      CreateProjectRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          description: {
            type: ["string", "null"],
            maxLength: 1000,
          },
        },
        required: ["name"],
      },
      UpdateProjectRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          description: {
            type: ["string", "null"],
            maxLength: 1000,
          },
          status: {
            type: "string",
            enum: ["draft", "completed"],
          },
          data: {
            oneOf: [
              { $ref: "#/components/schemas/ProjectData" },
              { type: "null" },
            ],
          },
        },
        additionalProperties: false,
      },
      TeamSelection: {
        type: "object",
        properties: {
          role: { type: "string" },
          count: { type: "integer", minimum: 1 },
          weight: { type: "number", minimum: 0 },
        },
        required: ["role", "count"],
      },
      CalculateRequest: {
        type: "object",
        properties: {
          services: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          technologies: {
            type: "object",
            properties: {
              frontend: { type: "string" },
              backend: { type: "string" },
              database: { type: "string" },
              mobile: { type: ["string", "null"] },
            },
            required: ["frontend", "backend", "database"],
          },
          team: {
            type: "array",
            items: { $ref: "#/components/schemas/TeamSelection" },
            minItems: 1,
          },
        },
        required: ["services", "technologies", "team"],
      },
      CalculationRole: {
        type: "object",
        properties: {
          role: { type: "string" },
          label: { type: "string" },
          hourly_rate: { type: "number" },
          base_hours: { type: "number" },
          coefficient: { type: "number" },
          adjusted_hours: { type: "number" },
          cost: { type: "number" },
          count: { type: "integer" },
          weight: {
            type: "number",
            description:
              "Вес роли при распределении часов. В снапшотах старого формата отсутствует (трактуется как 1).",
          },
        },
        required: [
          "role",
          "label",
          "hourly_rate",
          "base_hours",
          "coefficient",
          "adjusted_hours",
          "cost",
          "count",
        ],
      },
      CalculationService: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          hours: { type: "number" },
          cost: { type: ["number", "null"] },
          is_custom: { type: "boolean" },
        },
        required: ["key", "label", "hours", "cost", "is_custom"],
      },
      CalculationResult: {
        type: "object",
        properties: {
          version: {
            type: "string",
            description:
              "Версия алгоритма расчёта. В снапшотах старого формата может отсутствовать; клиент трактует это как legacy-версию.",
          },
          total_base_hours: { type: "number" },
          total_adjusted_hours: { type: "number" },
          total_cost: { type: "number" },
          calendar_days: { type: "number" },
          roles: {
            type: "array",
            items: { $ref: "#/components/schemas/CalculationRole" },
          },
          services: {
            type: "array",
            items: { $ref: "#/components/schemas/CalculationService" },
          },
          custom_service_fixed_cost: { type: "number" },
        },
        required: [
          "total_base_hours",
          "total_adjusted_hours",
          "total_cost",
          "calendar_days",
          "roles",
          "services",
          "custom_service_fixed_cost",
        ],
      },
      ProjectData: {
        type: "object",
        description:
          "Содержимое поля `data` проекта: параметры конструктора и сохранённый снапшот расчёта.",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          selectedServices: {
            type: "array",
            items: { type: "string" },
          },
          technology: {
            type: "object",
            properties: {
              frontend: { type: "string" },
              backend: { type: "string" },
              database: { type: "string" },
              mobile: { type: "string" },
            },
          },
          teamRoles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                label: { type: "string" },
                count: { type: "integer" },
                weight: { type: "number" },
              },
              required: ["role", "label", "count"],
            },
          },
          result: { $ref: "#/components/schemas/CalculationResult" },
        },
        additionalProperties: true,
      },
      UserRate: {
        type: "object",
        properties: {
          role: { type: "string" },
          hourly_rate: { type: "integer" },
        },
        required: ["role", "hourly_rate"],
      },
      UserServiceHour: {
        type: "object",
        properties: {
          service_key: { type: "string" },
          hours: { type: "integer" },
          fixed_cost: { type: ["integer", "null"] },
        },
        required: ["service_key", "hours", "fixed_cost"],
      },
      CustomService: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: ["string", "null"], format: "uuid" },
          name: { type: "string" },
          hours: { type: "integer" },
          fixed_cost: { type: ["integer", "null"] },
          icon_url: { type: ["string", "null"], format: "uri" },
          created_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "user_id",
          "name",
          "hours",
          "fixed_cost",
          "icon_url",
          "created_at",
        ],
      },
      CustomServiceRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          hours: { type: "integer", minimum: 0 },
          fixed_cost: { type: ["integer", "null"] },
          icon_url: { type: ["string", "null"], format: "uri" },
        },
        required: ["name", "hours"],
      },
      GlobalRate: {
        type: "object",
        properties: {
          role: { type: "string" },
          hourly_rate: { type: "integer" },
        },
        required: ["role", "hourly_rate"],
      },
      GlobalServiceHour: {
        type: "object",
        properties: {
          service_key: { type: "string" },
          hours: { type: "integer" },
          fixed_cost: { type: ["integer", "null"] },
        },
        required: ["service_key", "hours", "fixed_cost"],
      },
      TechnologyCoefficient: {
        type: "object",
        properties: {
          technology_key: { type: "string" },
          coefficient: { type: "number" },
        },
        required: ["technology_key", "coefficient"],
      },
      UpdateUserRequest: {
        type: "object",
        properties: {
          project_limit: { type: "integer", minimum: 1 },
          is_admin: { type: "boolean" },
          subscription_tier: {
            type: "string",
            enum: ["free", "pro", "business"],
          },
        },
        additionalProperties: false,
      },
      UserAdminView: {
        allOf: [
          { $ref: "#/components/schemas/Profile" },
          {
            type: "object",
            properties: {
              project_count: { type: "integer" },
            },
            required: ["project_count"],
          },
        ],
      },
      UserLimits: {
        type: "object",
        properties: {
          subscription_tier: {
            type: "string",
            enum: ["free", "pro", "business"],
          },
          project_limit: { type: "integer" },
          custom_services_limit: { type: "integer" },
          projects_used: { type: "integer" },
          can_create_project: { type: "boolean" },
        },
        required: [
          "subscription_tier",
          "project_limit",
          "custom_services_limit",
          "projects_used",
          "can_create_project",
        ],
      },
      SubscriptionStatus: {
        type: "object",
        properties: {
          subscription_tier: {
            type: "string",
            enum: ["free", "pro", "business"],
          },
          project_limit: { type: "integer" },
          custom_services_limit: { type: "integer" },
        },
        required: [
          "subscription_tier",
          "project_limit",
          "custom_services_limit",
        ],
      },
      ExportPdfRequest: {
        type: "object",
        properties: {
          project: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name"],
          },
          result: { $ref: "#/components/schemas/CalculationResult" },
          technology: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          teamRoles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                label: { type: "string" },
                count: { type: "integer" },
              },
              required: ["role", "label", "count"],
            },
          },
        },
        required: ["project", "result", "technology", "teamRoles"],
      },
    },
  },
  paths: {
    "/api/projects": {
      get: {
        tags: ["Projects"],
        summary: "Получить проекты пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Список проектов",
            content: jsonContent({
              type: "object",
              properties: {
                projects: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Project" },
                },
              },
              required: ["projects"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка загрузки проектов", {
            error: "Ошибка при загрузке проектов",
          }),
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Создать проект",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateProjectRequest",
          }),
        },
        responses: {
          "201": {
            description: "Проект создан",
            content: jsonContent({
              type: "object",
              properties: {
                project: { $ref: "#/components/schemas/Project" },
              },
              required: ["project"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка создания проекта", {
            error: "Ошибка при создании проекта",
          }),
        },
      },
    },
    "/api/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Получить проект по ID",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Проект найден",
            content: jsonContent({
              type: "object",
              properties: {
                project: { $ref: "#/components/schemas/Project" },
              },
              required: ["project"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "404": errorResponse("Проект не найден", { error: "Проект не найден" }),
          "500": errorResponse("Ошибка загрузки проекта", {
            error: "Ошибка при загрузке проекта",
          }),
        },
      },
      put: {
        tags: ["Projects"],
        summary: "Обновить проект по ID",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateProjectRequest",
          }),
        },
        responses: {
          "200": {
            description: "Проект обновлён",
            content: jsonContent({
              type: "object",
              properties: {
                project: { $ref: "#/components/schemas/Project" },
              },
              required: ["project"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "404": errorResponse("Проект не найден", { error: "Проект не найден" }),
          "500": errorResponse("Ошибка обновления проекта", {
            error: "Ошибка при обновлении проекта",
          }),
        },
      },
      delete: {
        tags: ["Projects"],
        summary: "Удалить проект по ID",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Проект удалён",
            content: jsonContent({
              type: "object",
              properties: {
                success: { type: "boolean" },
              },
              required: ["success"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "404": errorResponse("Проект не найден", { error: "Проект не найден" }),
          "500": errorResponse("Ошибка удаления проекта", {
            error: "Ошибка при удалении проекта",
          }),
        },
      },
    },
    "/api/calculate": {
      post: {
        tags: ["Calculation"],
        summary: "Рассчитать стоимость и сроки проекта",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CalculateRequest",
          }),
        },
        responses: {
          "200": {
            description: "Результат расчёта",
            content: jsonContent({
              type: "object",
              properties: {
                result: { $ref: "#/components/schemas/CalculationResult" },
              },
              required: ["result"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка при расчёте", {
            error: "Ошибка при расчёте",
          }),
        },
      },
    },
    "/api/settings/user": {
      get: {
        tags: ["Settings"],
        summary: "Получить пользовательские настройки",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Настройки пользователя",
            content: jsonContent({
              type: "object",
              properties: {
                user_rates: {
                  type: "array",
                  items: { $ref: "#/components/schemas/UserRate" },
                },
                user_service_hours: {
                  type: "array",
                  items: { $ref: "#/components/schemas/UserServiceHour" },
                },
                custom_services: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CustomService" },
                },
              },
              required: ["user_rates", "user_service_hours", "custom_services"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
        },
      },
      put: {
        tags: ["Settings"],
        summary: "Обновить ставки и часы пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            type: "object",
            properties: {
              user_rates: {
                type: "array",
                items: { $ref: "#/components/schemas/UserRate" },
              },
              user_service_hours: {
                type: "array",
                items: { $ref: "#/components/schemas/UserServiceHour" },
              },
            },
          }),
        },
        responses: {
          "200": {
            description: "Настройки обновлены",
            content: jsonContent({
              type: "object",
              properties: {
                success: { type: "boolean" },
              },
              required: ["success"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
        },
      },
    },
    "/api/custom-services": {
      post: {
        tags: ["Custom Services"],
        summary: "Создать кастомный сервис",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CustomServiceRequest",
          }),
        },
        responses: {
          "201": {
            description: "Сервис создан",
            content: jsonContent({
              type: "object",
              properties: {
                service: { $ref: "#/components/schemas/CustomService" },
              },
              required: ["service"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Лимит исчерпан", {
            error: "Лимит кастомных сервисов исчерпан",
          }),
          "500": errorResponse("Ошибка создания", {
            error: "Ошибка при создании",
          }),
        },
      },
      put: {
        tags: ["Custom Services"],
        summary: "Обновить кастомный сервис",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CustomServiceRequest",
          }),
        },
        responses: {
          "200": {
            description: "Сервис обновлён",
            content: jsonContent({
              type: "object",
              properties: {
                service: { $ref: "#/components/schemas/CustomService" },
              },
              required: ["service"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка обновления", {
            error: "Ошибка при обновлении",
          }),
        },
      },
      delete: {
        tags: ["Custom Services"],
        summary: "Удалить кастомный сервис",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Сервис удалён",
            content: jsonContent({
              type: "object",
              properties: {
                success: { type: "boolean" },
              },
              required: ["success"],
            }),
          },
          "400": errorResponse("ID не указан", { error: "ID не указан" }),
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка удаления", {
            error: "Ошибка при удалении",
          }),
        },
      },
    },
    "/api/custom-services/upload-icon": {
      post: {
        tags: ["Custom Services"],
        summary: "Загрузить иконку кастомного сервиса",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Иконка загружена",
            content: jsonContent({
              type: "object",
              properties: {
                url: { type: "string", format: "uri" },
              },
              required: ["url"],
            }),
          },
          "400": errorResponse("Файл невалиден", {
            error: "Допустимы только PNG и SVG файлы",
          }),
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка загрузки файла", {
            error: "Ошибка при загрузке файла",
          }),
        },
      },
    },
    "/api/user/profile": {
      get: {
        tags: ["User"],
        summary: "Получить профиль пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Профиль пользователя",
            content: jsonContent({
              type: "object",
              properties: {
                profile: { $ref: "#/components/schemas/Profile" },
              },
              required: ["profile"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка загрузки профиля", {
            error: "Ошибка при загрузке профиля",
          }),
        },
      },
      put: {
        tags: ["User"],
        summary: "Обновить профиль пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            type: "object",
            properties: {
              full_name: {
                type: "string",
                minLength: 2,
                maxLength: 100,
              },
            },
            additionalProperties: false,
          }),
        },
        responses: {
          "200": {
            description: "Профиль обновлён",
            content: jsonContent({
              type: "object",
              properties: {
                profile: { $ref: "#/components/schemas/Profile" },
              },
              required: ["profile"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка обновления профиля", {
            error: "Ошибка при обновлении профиля",
          }),
        },
      },
    },
    "/api/user/limits": {
      get: {
        tags: ["User"],
        summary: "Получить лимиты текущего пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Лимиты пользователя",
            content: jsonContent({
              $ref: "#/components/schemas/UserLimits",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка загрузки профиля", {
            error: "Ошибка при загрузке профиля",
          }),
        },
      },
    },
    "/api/subscription/status": {
      get: {
        tags: ["User"],
        summary: "Получить статус подписки",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Статус подписки",
            content: jsonContent({
              $ref: "#/components/schemas/SubscriptionStatus",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "500": errorResponse("Ошибка загрузки статуса подписки", {
            error: "Ошибка при загрузке статуса подписки",
          }),
        },
      },
    },
    "/api/technologies/coefficients": {
      get: {
        tags: ["Reference"],
        summary: "Получить коэффициенты технологий",
        responses: {
          "200": {
            description: "Список коэффициентов",
            content: jsonContent({
              type: "object",
              properties: {
                coefficients: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/TechnologyCoefficient",
                  },
                },
              },
              required: ["coefficients"],
            }),
          },
          "500": errorResponse("Ошибка загрузки коэффициентов", {
            error: "Ошибка при загрузке коэффициентов",
          }),
        },
      },
    },
    "/api/admin/settings/global": {
      get: {
        tags: ["Admin"],
        summary: "Получить глобальные настройки",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Глобальные настройки",
            content: jsonContent({
              type: "object",
              properties: {
                global_rates: {
                  type: "array",
                  items: { $ref: "#/components/schemas/GlobalRate" },
                },
                global_service_hours: {
                  type: "array",
                  items: { $ref: "#/components/schemas/GlobalServiceHour" },
                },
                technology_coefficients: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/TechnologyCoefficient",
                  },
                },
              },
              required: [
                "global_rates",
                "global_service_hours",
                "technology_coefficients",
              ],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Доступ запрещён", { error: "Доступ запрещён" }),
        },
      },
      put: {
        tags: ["Admin"],
        summary: "Обновить глобальные настройки",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            type: "object",
            properties: {
              global_rates: {
                type: "array",
                items: { $ref: "#/components/schemas/GlobalRate" },
              },
              global_service_hours: {
                type: "array",
                items: { $ref: "#/components/schemas/GlobalServiceHour" },
              },
              technology_coefficients: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/TechnologyCoefficient",
                },
              },
            },
          }),
        },
        responses: {
          "200": {
            description: "Настройки обновлены",
            content: jsonContent({
              type: "object",
              properties: {
                success: { type: "boolean" },
                rates: {
                  type: "array",
                  items: { $ref: "#/components/schemas/GlobalRate" },
                },
                hours: {
                  type: "array",
                  items: { $ref: "#/components/schemas/GlobalServiceHour" },
                },
                coefficients: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/TechnologyCoefficient",
                  },
                },
              },
              required: ["success"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Доступ запрещён", { error: "Доступ запрещён" }),
          "500": errorResponse("Ошибка обновления настроек", {
            error: "Ошибка обновления коэффициента",
          }),
        },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Получить список пользователей",
        security: [{ SupabaseSessionCookie: [] }],
        responses: {
          "200": {
            description: "Список пользователей",
            content: jsonContent({
              type: "object",
              properties: {
                users: {
                  type: "array",
                  items: { $ref: "#/components/schemas/UserAdminView" },
                },
              },
              required: ["users"],
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Доступ запрещён", { error: "Доступ запрещён" }),
          "500": errorResponse("Ошибка загрузки пользователей", {
            error: "Ошибка при загрузке пользователей",
          }),
        },
      },
      put: {
        tags: ["Admin"],
        summary: "Обновить пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateUserRequest",
          }),
        },
        responses: {
          "200": {
            description: "Пользователь обновлён",
            content: jsonContent({
              type: "object",
              properties: {
                profile: { $ref: "#/components/schemas/Profile" },
              },
              required: ["profile"],
            }),
          },
          "400": {
            description: "Некорректные данные",
            content: jsonContent({
              $ref: "#/components/schemas/ValidationError",
            }),
          },
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Доступ запрещён", { error: "Доступ запрещён" }),
          "500": errorResponse("Ошибка обновления пользователя", {
            error: "Ошибка при обновлении пользователя",
          }),
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Удалить пользователя",
        security: [{ SupabaseSessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Пользователь удалён",
            content: jsonContent({
              type: "object",
              properties: {
                success: { type: "boolean" },
              },
              required: ["success"],
            }),
          },
          "400": errorResponse("Некорректный запрос", {
            error: "ID пользователя не указан",
          }),
          "401": errorResponse("Не авторизован", { error: "Не авторизован" }),
          "403": errorResponse("Доступ запрещён", { error: "Доступ запрещён" }),
          "500": errorResponse("Ошибка удаления пользователя", {
            error: "Ошибка при удалении пользователя",
          }),
        },
      },
    },
    "/api/export/pdf": {
      post: {
        tags: ["Export"],
        summary: "Экспортировать результат в PDF",
        description:
          "Серверная генерация PDF через @react-pdf/renderer. Ответ — бинарный " +
          "файл application/pdf с Content-Disposition attachment. Для тарифа " +
          "`free` (и при отсутствии/неизвестном тарифе) в документ добавляется " +
          "водяной знак «MVP Calculator Demo»; для тарифов `pro` и `business` " +
          "знака нет. Тариф определяется на сервере по таблице profiles, " +
          "значение из тела запроса игнорируется.",
        security: [{ SupabaseSessionCookie: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/ExportPdfRequest",
          }),
        },
        responses: {
          "200": {
            description: "PDF-файл для скачивания",
            content: {
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": errorResponse("Неверные данные", {
            error: "Неверные данные",
          }),
          "500": errorResponse("Ошибка при генерации PDF", {
            error: "Ошибка при генерации PDF",
          }),
        },
      },
    },
  },
} as const;
