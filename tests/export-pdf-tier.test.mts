import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { NextRequest } from "next/server";
import { Document, Page, Text } from "@react-pdf/renderer";
import {
  createMockSupabaseClient,
  type MockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";

let serverOptions: MockSupabaseOptions = {};
let currentClient: MockSupabaseClient | null = null;
const capturedIsFree: boolean[] = [];

mock.module("../lib/supabase/server.ts", {
  namedExports: {
    createClient: async () => {
      currentClient = createMockSupabaseClient(serverOptions);
      return currentClient;
    },
  },
});

// Replace the report builder so we can observe the `isFree` flag the route
// derives from the server-side subscription tier, while still returning a
// valid document that `renderToBuffer` can render.
mock.module("../lib/pdf/report.ts", {
  namedExports: {
    buildReportDocument: (snapshot: { isFree: boolean }) => {
      capturedIsFree.push(snapshot.isFree);
      return React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          null,
          React.createElement(Text, null, "report")
        )
      );
    },
  },
});

const { POST: exportPdfPost } = await import("../app/api/export/pdf/route.ts");

const sampleBody = {
  project: { name: "Тестовый проект", description: "Описание" },
  result: {
    version: "1.0",
    total_base_hours: 120,
    total_adjusted_hours: 150,
    total_cost: 1234567,
    calendar_days: 45,
    roles: [],
    services: [],
    custom_service_fixed_cost: 0,
  },
  technology: {
    frontend: "React",
    backend: "Node",
    database: "Postgres",
    mobile: "",
  },
  teamRoles: [],
};

function asUser(tier: string | null) {
  serverOptions = tier
    ? {
        user: { id: "user-1", email: "user@example.com" },
        responses: {
          profiles: { data: { subscription_tier: tier }, error: null },
        },
      }
    : {
        user: { id: "user-1", email: "user@example.com" },
        responses: { profiles: { data: null, error: null } },
      };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/export/pdf", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  capturedIsFree.length = 0;
  currentClient = null;
});

// --- watermark by subscription tier (phase 19, #58) ---

test("free: серверный тариф free включает водяной знак (isFree=true)", async () => {
  asUser("free");

  const response = await exportPdfPost(jsonRequest(sampleBody));

  assert.equal(response.status, 200);
  assert.deepEqual(capturedIsFree, [true]);
});

test("pro: серверный тариф pro отключает водяной знак (isFree=false)", async () => {
  asUser("pro");

  const response = await exportPdfPost(jsonRequest(sampleBody));

  assert.equal(response.status, 200);
  assert.deepEqual(capturedIsFree, [false]);
});

test("business: серверный тариф business отключает водяной знак (isFree=false)", async () => {
  asUser("business");

  const response = await exportPdfPost(jsonRequest(sampleBody));

  assert.equal(response.status, 200);
  assert.deepEqual(capturedIsFree, [false]);
});

test("тариф читается из БД, а не из тела запроса (клиент недоверенный)", async () => {
  asUser("free");

  const response = await exportPdfPost(
    jsonRequest({ ...sampleBody, subscription_tier: "pro" })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    capturedIsFree,
    [true],
    "подделанный в теле тариф не должен влиять на водяной знак"
  );
});

test("тариф запрашивается на сервере у таблицы profiles по id пользователя", async () => {
  asUser("pro");

  await exportPdfPost(jsonRequest(sampleBody));

  const profileQuery = currentClient?.queries.find(
    (query) => query.table === "profiles"
  );
  assert.ok(profileQuery, "должен быть запрос к таблице profiles");
  assert.ok(
    profileQuery.calls.some(
      (call) =>
        call.method === "select" &&
        (call.args[0] as string).includes("subscription_tier")
    ),
    "должен запрашиваться столбец subscription_tier"
  );
  assert.ok(
    profileQuery.calls.some(
      (call) => call.method === "eq" && call.args[0] === "id" && call.args[1] === "user-1"
    ),
    "тариф должен браться по id текущего пользователя"
  );
});

test("отсутствие профиля трактуется как free (водяной знак включён)", async () => {
  asUser(null);

  const response = await exportPdfPost(jsonRequest(sampleBody));

  assert.equal(response.status, 200);
  assert.deepEqual(capturedIsFree, [true]);
});
