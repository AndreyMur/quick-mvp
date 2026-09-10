import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateProject } from "../lib/calculate.ts";
import type {
  CalculateInput,
  CalculationReferences,
} from "../lib/types/project.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function emptyReferences(): CalculationReferences {
  return {
    globalRates: [],
    userRates: [],
    globalServiceHours: [],
    userServiceHours: [],
    customServices: [],
    technologyCoefficients: [],
  };
}

function assertClose(actual: number, expected: number, message?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    message ?? `expected ${actual} to be close to ${expected}`
  );
}

test("равное распределение: база делится поровну между активными ролями", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [
      { role: "project_manager", count: 1 },
      { role: "frontend_developer", count: 1 },
      { role: "backend_developer", count: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 90, fixed_cost: null }],
    globalRates: [
      { role: "project_manager", hourly_rate: 100 },
      { role: "frontend_developer", hourly_rate: 100 },
      { role: "backend_developer", hourly_rate: 100 },
    ],
  };

  const result = calculateProject(input, references);

  assert.equal(result.total_base_hours, 90);
  assert.equal(result.roles.length, 3);
  for (const role of result.roles) {
    assertClose(role.base_hours, 30);
    assert.equal(role.coefficient, 1);
    assertClose(role.adjusted_hours, 30);
    assertClose(role.cost, 3000);
  }
  assertClose(result.total_adjusted_hours, 90);
  assertClose(result.total_cost, 9000);
  assertClose(result.calendar_days, 90 / (3 * 8));
});

test("коэффициенты технологий применяются к своим ролям", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: {
      frontend: "react",
      backend: "node_js",
      database: "postgresql",
      mobile: null,
    },
    team: [
      { role: "frontend_developer", count: 1 },
      { role: "backend_developer", count: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 80, fixed_cost: null }],
    globalRates: [
      { role: "frontend_developer", hourly_rate: 100 },
      { role: "backend_developer", hourly_rate: 200 },
    ],
    technologyCoefficients: [
      { technology_key: "react", coefficient: 1.5 },
      { technology_key: "node_js", coefficient: 1.2 },
      { technology_key: "postgresql", coefficient: 1.1 },
    ],
  };

  const result = calculateProject(input, references);

  const frontend = result.roles.find((r) => r.role === "frontend_developer");
  const backend = result.roles.find((r) => r.role === "backend_developer");
  assert.ok(frontend);
  assert.ok(backend);

  assert.equal(frontend.coefficient, 1.5);
  assertClose(frontend.adjusted_hours, 40 * 1.5);
  assertClose(frontend.cost, 40 * 1.5 * 100);

  assertClose(backend.coefficient, 1.2 * 1.1);
  assertClose(backend.adjusted_hours, 40 * 1.2 * 1.1);
  assertClose(backend.cost, 40 * 1.2 * 1.1 * 200);

  assertClose(result.total_adjusted_hours, 40 * 1.5 + 40 * 1.2 * 1.1);
  assertClose(result.total_cost, 40 * 1.5 * 100 + 40 * 1.2 * 1.1 * 200);
  assertClose(result.calendar_days, (40 * 1.5 + 40 * 1.2 * 1.1) / (2 * 8));
});

test("приоритет user → global по ставкам и часам; кастомные сервисы учитываются", () => {
  const input: CalculateInput = {
    services: ["web_app", "custom_1"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [{ role: "frontend_developer", count: 1 }],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 80, fixed_cost: null }],
    userServiceHours: [{ service_key: "web_app", hours: 50, fixed_cost: null }],
    globalRates: [{ role: "frontend_developer", hourly_rate: 100 }],
    userRates: [{ role: "frontend_developer", hourly_rate: 150 }],
    customServices: [
      { id: "custom_1", name: "Кастом", hours: 10, fixed_cost: 5000 },
    ],
  };

  const result = calculateProject(input, references);

  assert.equal(result.total_base_hours, 60);
  assert.equal(result.services.length, 2);
  assert.equal(result.custom_service_fixed_cost, 5000);

  const role = result.roles[0];
  assert.equal(role.hourly_rate, 150);
  assertClose(role.adjusted_hours, 60);
  assertClose(role.cost, 60 * 150);

  assertClose(result.total_cost, 60 * 150 + 5000);
  assertClose(result.calendar_days, 60 / 8);
});

test("роль без ставки даёт стоимость 0", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [{ role: "devops", count: 1 }],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 40, fixed_cost: null }],
  };

  const result = calculateProject(input, references);

  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0].hourly_rate, 0);
  assert.equal(result.roles[0].cost, 0);
  assert.equal(result.total_cost, 0);
});

test("пустой выбор ролей не роняет расчёт", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 40, fixed_cost: null }],
  };

  const result = calculateProject(input, references);

  assert.equal(result.roles.length, 0);
  assert.equal(result.total_adjusted_hours, 0);
  assert.equal(result.total_cost, 0);
  assert.equal(result.calendar_days, 0);
});

test("детерминированность: повторный прогон даёт тот же результат", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "react", backend: "", database: "", mobile: null },
    team: [
      { role: "frontend_developer", count: 2 },
      { role: "qa_engineer", count: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 120, fixed_cost: null }],
    globalRates: [
      { role: "frontend_developer", hourly_rate: 120 },
      { role: "qa_engineer", hourly_rate: 80 },
    ],
    technologyCoefficients: [{ technology_key: "react", coefficient: 1.4 }],
  };

  const first = calculateProject(input, references);
  const second = calculateProject(input, references);
  assert.deepEqual(first, second);
});

test("чистое ядро не содержит обращений к Supabase", () => {
  const source = readFileSync(join(HERE, "..", "lib", "calculate.ts"), "utf8");
  assert.doesNotMatch(source, /supabase/i);
  assert.doesNotMatch(source, /createClient/);
  assert.doesNotMatch(source, /from\s+["']@\/lib\/supabase/);
});
