import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { isValidElement, type ReactNode } from "react";
import {
  createMockSupabaseClient,
  type MockSupabaseOptions,
} from "./mocks/supabase.ts";
import type { CalculationResult } from "../lib/types/project.ts";

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

const { POST: exportPdfPost } = await import("../app/api/export/pdf/route.ts");
const { buildReportDocument } = await import("../lib/pdf/report.ts");

const sampleResult: CalculationResult = {
  version: "1.0",
  total_base_hours: 120,
  total_adjusted_hours: 150,
  total_cost: 1234567,
  calendar_days: 45,
  roles: [
    {
      role: "frontend_developer",
      label: "Frontend-разработчик",
      hourly_rate: 1000,
      base_hours: 60,
      coefficient: 1.2,
      adjusted_hours: 72,
      cost: 72000,
      count: 1,
      weight: 1,
    },
  ],
  services: [
    {
      key: "web_app",
      label: "Веб-приложение",
      hours: 120,
      cost: null,
      is_custom: false,
    },
  ],
  custom_service_fixed_cost: 0,
};

const sampleBody = {
  project: { name: "Тестовый проект", description: "Описание проекта" },
  result: sampleResult,
  technology: {
    frontend: "React",
    backend: "Node",
    database: "Postgres",
    mobile: "",
  },
  teamRoles: [
    { role: "frontend_developer", label: "Frontend-разработчик", count: 1 },
  ],
};

function asUser(tier: string) {
  serverOptions = {
    user: { id: "user-1", email: "user@example.com" },
    responses: { profiles: { data: { subscription_tier: tier }, error: null } },
  };
}

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function collectText(node: ReactNode, acc: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return acc;
  }
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, acc);
    return acc;
  }
  if (isValidElement(node)) {
    collectText((node.props as { children?: ReactNode }).children, acc);
  }
  return acc;
}

// --- endpoint contract (task #52) ---

test("/api/export/pdf: возвращает настоящий PDF (application/pdf)", async () => {
  asUser("pro");

  const response = await exportPdfPost(
    jsonRequest("http://localhost/api/export/pdf", sampleBody)
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/pdf/
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(
    buffer.includes(Buffer.from("%%EOF")),
    "PDF должен завершаться маркером %%EOF"
  );
  assert.ok(buffer.length > 1000, "PDF не должен быть пустым");
});

test("/api/export/pdf: имя файла формируется из названия проекта", async () => {
  asUser("pro");

  const response = await exportPdfPost(
    jsonRequest("http://localhost/api/export/pdf", sampleBody)
  );

  const disposition = response.headers.get("content-disposition") ?? "";
  assert.match(disposition, /attachment/);
  assert.match(disposition, /\.pdf/);
  assert.ok(
    disposition.includes(encodeURIComponent("Тестовый проект")),
    "кириллическое имя должно быть закодировано в filename*"
  );
});

test("/api/export/pdf: невалидные данные отклоняются (400)", async () => {
  asUser("pro");

  const response = await exportPdfPost(
    jsonRequest("http://localhost/api/export/pdf", { project: { name: "" } })
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, "Неверные данные");
});

// --- minimal template contents (task #53) ---

test("шаблон: содержит заголовок с логотипом и датой", async () => {
  const document = buildReportDocument({
    project: { name: "Тестовый проект", description: "Описание проекта" },
    result: sampleResult,
    isFree: true,
  });
  const text = collectText(document).join("\n");

  assert.ok(text.includes("MVP Calculator"), "ожидался логотип/бренд");
  assert.ok(text.includes("Тестовый проект"), "ожидалось название проекта");
  assert.match(text, /\d{4}/, "ожидалась дата");
});

test("шаблон: содержит сводные показатели (стоимость, часы, дни)", async () => {
  const document = buildReportDocument({
    project: { name: "Тестовый проект" },
    result: sampleResult,
    isFree: false,
  });
  const text = collectText(document).join("\n").replace(/\u00a0/g, " ");

  assert.ok(text.includes("Стоимость"));
  assert.ok(text.includes("1 234 567"), "ожидалась стоимость проекта");
  assert.ok(text.includes("Человеко-часы"));
  assert.ok(text.includes("150"), "ожидались человеко-часы");
  assert.ok(text.includes("Календарные дни"));
  assert.ok(text.includes("45"), "ожидались календарные дни");
});

test("шаблон: водяной знак только для free-тарифа", () => {
  const free = collectText(
    buildReportDocument({
      project: { name: "Проект" },
      result: sampleResult,
      isFree: true,
    })
  ).join("\n");
  const pro = collectText(
    buildReportDocument({
      project: { name: "Проект" },
      result: sampleResult,
      isFree: false,
    })
  ).join("\n");

  assert.ok(free.includes("MVP Calculator Demo"));
  assert.ok(!pro.includes("MVP Calculator Demo"));
});
