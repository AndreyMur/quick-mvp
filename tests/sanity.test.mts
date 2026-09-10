import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createMockSupabaseClient } from "./mocks/supabase.ts";

// --- Sanity: the runner itself is alive (task #44) ---

test("sanity: тестовый раннер запускается", () => {
  assert.equal(1 + 1, 2);
});

test("sanity: фреймворк поддерживает моки модулей", () => {
  assert.equal(typeof mock.module, "function");
  assert.equal(typeof mock.fn, "function");
});

// --- Sanity: Supabase clients are mocked and work offline (task #43) ---

test("sanity: createAdminClient замокан и работает без сети", async () => {
  mock.module("../lib/supabase/admin.ts", {
    namedExports: {
      createAdminClient: () =>
        createMockSupabaseClient({
          responses: { projects: { data: [{ id: "p1" }], error: null } },
        }),
    },
  });

  const { createAdminClient } = await import("../lib/supabase/admin.ts");
  const admin = createAdminClient();
  const { data, error } = await admin.from("projects").select("*");

  assert.equal(error, null);
  assert.deepEqual(data, [{ id: "p1" }]);
});

test("sanity: createClient (server) замокан и отдаёт пользователя", async () => {
  mock.module("../lib/supabase/server.ts", {
    namedExports: {
      createClient: async () =>
        createMockSupabaseClient({ user: { id: "user-1", email: "a@b.c" } }),
    },
  });

  const { createClient } = await import("../lib/supabase/server.ts");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  assert.equal(error, null);
  assert.equal(data.user?.id, "user-1");
});

test("sanity: мок детерминирован и не ходит в сеть", async () => {
  const client = createMockSupabaseClient({
    user: { id: "user-1" },
    responses: { profiles: { data: [{ id: "user-1", is_admin: true }], error: null } },
  });

  const first = await client.from("profiles").select("is_admin").eq("id", "user-1").single();
  const second = await client.from("profiles").select("is_admin").eq("id", "user-1").single();

  assert.deepEqual(first, second);
  assert.equal(client.queries.length, 2);
  assert.equal(client.queries[0].table, "profiles");
});
