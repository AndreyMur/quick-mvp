import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";

let serverOptions: MockSupabaseOptions = {};

mock.module("../lib/supabase/server.ts", {
  namedExports: {
    createClient: async () => createMockSupabaseClient(serverOptions),
  },
});

mock.module("../lib/supabase/admin.ts", {
  namedExports: {
    createAdminClient: () => createMockSupabaseClient(serverOptions),
  },
});

const { POST: calculatePost } = await import("../app/api/calculate/route.ts");
const { GET: projectsGet, POST: projectsPost } = await import(
  "../app/api/projects/route.ts"
);
const {
  GET: projectGet,
  PUT: projectPut,
  DELETE: projectDelete,
} = await import("../app/api/projects/[id]/route.ts");
const {
  GET: adminUsersGet,
  PUT: adminUsersPut,
  DELETE: adminUsersDelete,
} = await import("../app/api/admin/users/route.ts");
const { GET: adminSettingsGet, PUT: adminSettingsPut } = await import(
  "../app/api/admin/settings/global/route.ts"
);

const projectParams = { params: Promise.resolve({ id: "p1" }) };

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function asUnauthenticated() {
  serverOptions = { user: null };
}

function asAuthError() {
  serverOptions = { user: null, authError: { message: "invalid token" } };
}

function asNonAdmin() {
  serverOptions = {
    user: { id: "user-1", email: "user@example.com" },
    responses: { profiles: { data: { is_admin: false }, error: null } },
  };
}

function asAdmin() {
  serverOptions = {
    user: { id: "admin-1", email: "admin@example.com" },
    responses: {
      profiles: (log) =>
        log.calls.some((call) => call.method === "single")
          ? { data: { is_admin: true }, error: null }
          : { data: [{ id: "user-1", is_admin: false }], error: null },
      projects: { data: null, error: null, count: 2 },
    },
  };
}

interface RouteCase {
  name: string;
  call: () => Promise<Response>;
}

// Every authenticated API route must reject anonymous callers with 401.
const authenticatedRoutes: RouteCase[] = [
  {
    name: "POST /api/calculate",
    call: () =>
      calculatePost(
        jsonRequest("http://localhost/api/calculate", {
          services: ["web_app"],
          technologies: { frontend: "", backend: "", database: "", mobile: null },
          team: [{ role: "frontend_developer", count: 1 }],
        })
      ),
  },
  { name: "GET /api/projects", call: () => projectsGet() },
  {
    name: "POST /api/projects",
    call: () => projectsPost(jsonRequest("http://localhost/api/projects", { name: "Проект" })),
  },
  {
    name: "GET /api/projects/[id]",
    call: () => projectGet(new NextRequest("http://localhost/api/projects/p1"), projectParams),
  },
  {
    name: "PUT /api/projects/[id]",
    call: () =>
      projectPut(
        jsonRequest("http://localhost/api/projects/p1", { name: "Новое" }, "PUT"),
        projectParams
      ),
  },
  {
    name: "DELETE /api/projects/[id]",
    call: () =>
      projectDelete(
        new NextRequest("http://localhost/api/projects/p1", { method: "DELETE" }),
        projectParams
      ),
  },
  { name: "GET /api/admin/users", call: () => adminUsersGet() },
  {
    name: "PUT /api/admin/users",
    call: () =>
      adminUsersPut(
        jsonRequest("http://localhost/api/admin/users?id=user-2", { is_admin: true }, "PUT")
      ),
  },
  {
    name: "DELETE /api/admin/users",
    call: () =>
      adminUsersDelete(
        new NextRequest("http://localhost/api/admin/users?id=user-2", { method: "DELETE" })
      ),
  },
  { name: "GET /api/admin/settings/global", call: () => adminSettingsGet() },
  {
    name: "PUT /api/admin/settings/global",
    call: () =>
      adminSettingsPut(
        jsonRequest("http://localhost/api/admin/settings/global", { global_rates: [] }, "PUT")
      ),
  },
];

// Admin-only endpoints must additionally reject authenticated non-admins with 403.
const adminRoutes = authenticatedRoutes.filter((route) =>
  route.name.includes("/api/admin/")
);

// --- Unauthenticated → 401 (task #49) ---

for (const route of authenticatedRoutes) {
  test(`401: ${route.name} без авторизации`, async () => {
    asUnauthenticated();
    const response = await route.call();
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, "Не авторизован");
  });

  test(`401: ${route.name} при ошибке авторизации`, async () => {
    asAuthError();
    const response = await route.call();
    assert.equal(response.status, 401);
  });
}

// --- Non-admin → 403 on admin endpoints (task #49) ---

for (const route of adminRoutes) {
  test(`403: ${route.name} для не-администратора`, async () => {
    asNonAdmin();
    const response = await route.call();
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, "Доступ запрещён");
  });
}

// --- Authorized access still works (task #49) ---

test("администратор получает доступ к админ-эндпоинтам (200)", async () => {
  asAdmin();
  const usersResponse = await adminUsersGet();
  assert.equal(usersResponse.status, 200);

  asAdmin();
  const settingsResponse = await adminSettingsGet();
  assert.equal(settingsResponse.status, 200);
});

test("не-администратор сохраняет доступ к своим неадминским роутам", async () => {
  asNonAdmin();
  const response = await projectsGet();
  assert.equal(response.status, 200);
});
