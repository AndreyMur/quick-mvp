import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";

// The route handlers resolve `@/lib/supabase/*` through the test loader; mocking
// the underlying module lets us drive auth and canned DB responses per test.
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
const { POST: projectsPost } = await import("../app/api/projects/route.ts");

function setUser(options: MockSupabaseOptions = {}) {
  serverOptions = { user: { id: "user-1", email: "user@example.com" }, ...options };
}

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validCalculateBody = {
  services: ["web_app"],
  technologies: { frontend: "", backend: "", database: "", mobile: null },
  team: [{ role: "frontend_developer", count: 1 }],
};

// --- /api/calculate Zod contract (task #48) ---

test("/api/calculate: корректные данные проходят (200)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", validCalculateBody)
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(payload.result, "ожидался результат расчёта");
  assert.ok(Array.isArray(payload.result.roles));
});

test("/api/calculate: пустой список сервисов отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      ...validCalculateBody,
      services: [],
    })
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, "Неверные данные");
  assert.ok(Array.isArray(payload.details));
});

test("/api/calculate: отсутствие сервисов отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      technologies: validCalculateBody.technologies,
      team: validCalculateBody.team,
    })
  );

  assert.equal(response.status, 400);
});

test("/api/calculate: пустая команда отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      ...validCalculateBody,
      team: [],
    })
  );

  assert.equal(response.status, 400);
});

test("/api/calculate: count ≤ 0 отклоняется (400)", async () => {
  setUser();

  for (const count of [0, -1]) {
    const response = await calculatePost(
      jsonRequest("http://localhost/api/calculate", {
        ...validCalculateBody,
        team: [{ role: "frontend_developer", count }],
      })
    );
    assert.equal(response.status, 400, `count=${count} должен отклоняться`);
  }
});

test("/api/calculate: нецелый count отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      ...validCalculateBody,
      team: [{ role: "frontend_developer", count: 1.5 }],
    })
  );

  assert.equal(response.status, 400);
});

test("/api/calculate: отрицательный вес отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      ...validCalculateBody,
      team: [{ role: "frontend_developer", count: 1, weight: -2 }],
    })
  );

  assert.equal(response.status, 400);
});

test("/api/calculate: отсутствие технологий отклоняется (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      services: validCalculateBody.services,
      team: validCalculateBody.team,
    })
  );

  assert.equal(response.status, 400);
});

test("/api/calculate: неверные типы полей отклоняются (400)", async () => {
  setUser();

  const response = await calculatePost(
    jsonRequest("http://localhost/api/calculate", {
      ...validCalculateBody,
      services: "web_app",
    })
  );

  assert.equal(response.status, 400);
});

// --- /api/projects Zod contract (task #48) ---

test("/api/projects: корректные данные проходят (201)", async () => {
  setUser({ responses: { projects: { data: { id: "p1", name: "Проект" }, error: null } } });

  const response = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "Проект" })
  );
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.project.id, "p1");
});

test("/api/projects: пустое название отклоняется (400)", async () => {
  setUser();

  for (const name of ["", undefined]) {
    const response = await projectsPost(
      jsonRequest("http://localhost/api/projects", { name })
    );
    assert.equal(response.status, 400, `name=${JSON.stringify(name)}`);
  }
});

test("/api/projects: название длиннее 200 символов отклоняется (400)", async () => {
  setUser();

  const response = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: "x".repeat(201) })
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, "Неверные данные");
});

test("/api/projects: описание длиннее 1000 символов отклоняется (400)", async () => {
  setUser();

  const response = await projectsPost(
    jsonRequest("http://localhost/api/projects", {
      name: "Проект",
      description: "x".repeat(1001),
    })
  );

  assert.equal(response.status, 400);
});

test("/api/projects: название неверного типа отклоняется (400)", async () => {
  setUser();

  const response = await projectsPost(
    jsonRequest("http://localhost/api/projects", { name: 42 })
  );

  assert.equal(response.status, 400);
});

test("/api/projects: корректное описание проходит (201)", async () => {
  setUser({ responses: { projects: { data: { id: "p2" }, error: null } } });

  const response = await projectsPost(
    jsonRequest("http://localhost/api/projects", {
      name: "Проект",
      description: "Описание",
    })
  );

  assert.equal(response.status, 201);
});
