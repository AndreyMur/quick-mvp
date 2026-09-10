import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateProject, CALCULATION_VERSION } from "../lib/calculate.ts";
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

test("неравные веса распределяют базовые часы пропорционально", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [
      { role: "frontend_developer", count: 1, weight: 3 },
      { role: "backend_developer", count: 1, weight: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 80, fixed_cost: null }],
    globalRates: [
      { role: "frontend_developer", hourly_rate: 100 },
      { role: "backend_developer", hourly_rate: 100 },
    ],
  };

  const result = calculateProject(input, references);

  const frontend = result.roles.find((r) => r.role === "frontend_developer");
  const backend = result.roles.find((r) => r.role === "backend_developer");
  assert.ok(frontend);
  assert.ok(backend);

  assert.equal(frontend.weight, 3);
  assert.equal(backend.weight, 1);
  assertClose(frontend.base_hours, 60);
  assertClose(backend.base_hours, 20);
  assertClose(frontend.cost, 6000);
  assertClose(backend.cost, 2000);
  assertClose(result.total_base_hours, 80);
  assertClose(result.total_adjusted_hours, 80);
  assertClose(result.total_cost, 8000);
});

test("равные веса дают результат, идентичный прежнему (регрессия)", () => {
  const base = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 90, fixed_cost: null }],
    globalRates: [
      { role: "project_manager", hourly_rate: 100 },
      { role: "frontend_developer", hourly_rate: 120 },
      { role: "backend_developer", hourly_rate: 140 },
    ],
  };

  const withoutWeights: CalculateInput = {
    ...base,
    team: [
      { role: "project_manager", count: 1 },
      { role: "frontend_developer", count: 1 },
      { role: "backend_developer", count: 1 },
    ],
  };
  const withEqualWeights: CalculateInput = {
    ...base,
    team: [
      { role: "project_manager", count: 1, weight: 1 },
      { role: "frontend_developer", count: 1, weight: 1 },
      { role: "backend_developer", count: 1, weight: 1 },
    ],
  };

  assert.deepEqual(
    calculateProject(withEqualWeights, references),
    calculateProject(withoutWeights, references)
  );
});

test("роль с нулевым весом получает 0 базовых часов", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [
      { role: "frontend_developer", count: 1, weight: 2 },
      { role: "qa_engineer", count: 1, weight: 0 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 60, fixed_cost: null }],
    globalRates: [
      { role: "frontend_developer", hourly_rate: 100 },
      { role: "qa_engineer", hourly_rate: 100 },
    ],
  };

  const result = calculateProject(input, references);

  const qa = result.roles.find((r) => r.role === "qa_engineer");
  assert.ok(qa);
  assert.equal(qa.base_hours, 0);
  assert.equal(qa.adjusted_hours, 0);
  assert.equal(qa.cost, 0);
  assertClose(result.total_base_hours, 60);
  assertClose(result.total_adjusted_hours, 60);
});

test("нулевая сумма весов не роняет расчёт и даёт равное распределение", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [
      { role: "frontend_developer", count: 1, weight: 0 },
      { role: "backend_developer", count: 1, weight: 0 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 80, fixed_cost: null }],
    globalRates: [
      { role: "frontend_developer", hourly_rate: 100 },
      { role: "backend_developer", hourly_rate: 100 },
    ],
  };

  const result = calculateProject(input, references);

  assert.equal(result.roles.length, 2);
  for (const role of result.roles) {
    assert.equal(role.weight, 1);
    assertClose(role.base_hours, 40);
  }
  assertClose(result.total_base_hours, 80);
  assertClose(result.total_adjusted_hours, 80);
});

test("результат содержит версию алгоритма", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "", backend: "", database: "", mobile: null },
    team: [{ role: "frontend_developer", count: 1 }],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 40, fixed_cost: null }],
  };

  const result = calculateProject(input, references);

  assert.equal(result.version, CALCULATION_VERSION);
  assert.match(result.version, /^\d+\.\d+\.\d+$/);
});

// --- Scenario 24 end-to-end reference set (task #45) ---

test("сценарий 24: эталонный набор покрывает все шаги расчёта", () => {
  const input: CalculateInput = {
    services: ["web_app", "auth", "custom_1"],
    technologies: {
      frontend: "react",
      backend: "node_js",
      database: "postgresql",
      mobile: null,
    },
    team: [
      { role: "project_manager", count: 1 },
      { role: "frontend_developer", count: 2 },
      { role: "backend_developer", count: 1 },
      { role: "qa_engineer", count: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    // Шаг 1: user → global по часам; кастомный сервис берёт часы и фикс из custom_services.
    globalServiceHours: [
      { service_key: "web_app", hours: 80, fixed_cost: null },
      { service_key: "auth", hours: 20, fixed_cost: null },
    ],
    userServiceHours: [{ service_key: "web_app", hours: 60, fixed_cost: null }],
    customServices: [
      { id: "custom_1", name: "Кастом", hours: 10, fixed_cost: 5000 },
    ],
    // Шаг 4: user → global по ставкам.
    globalRates: [
      { role: "project_manager", hourly_rate: 100 },
      { role: "frontend_developer", hourly_rate: 120 },
      { role: "backend_developer", hourly_rate: 150 },
      { role: "qa_engineer", hourly_rate: 80 },
    ],
    userRates: [{ role: "frontend_developer", hourly_rate: 130 }],
    // Шаг 3: коэффициенты по ролям через TECH_ROLE_MAP.
    technologyCoefficients: [
      { technology_key: "react", coefficient: 1.5 },
      { technology_key: "node_js", coefficient: 1.2 },
      { technology_key: "postgresql", coefficient: 1.1 },
    ],
  };

  const result = calculateProject(input, references);

  // Шаг 1: 60 (web_app, user) + 20 (auth, global) + 10 (custom) = 90
  assertClose(result.total_base_hours, 90);
  assert.equal(result.services.length, 3);
  assert.equal(result.custom_service_fixed_cost, 5000);

  // Шаг 2: равномерно между 4 активными ролями → по 22.5 ч
  for (const role of result.roles) {
    assertClose(role.base_hours, 22.5);
  }

  const pm = result.roles.find((r) => r.role === "project_manager");
  const frontend = result.roles.find((r) => r.role === "frontend_developer");
  const backend = result.roles.find((r) => r.role === "backend_developer");
  const qa = result.roles.find((r) => r.role === "qa_engineer");
  assert.ok(pm && frontend && backend && qa);

  // Шаг 3: PM/QA без коэффициента, frontend ×1.5, backend ×1.2×1.1
  assert.equal(pm.coefficient, 1);
  assertClose(frontend.coefficient, 1.5);
  assertClose(backend.coefficient, 1.32);
  assert.equal(qa.coefficient, 1);

  assertClose(frontend.adjusted_hours, 33.75);
  assertClose(backend.adjusted_hours, 29.7);
  assertClose(result.total_adjusted_hours, 108.45);

  // Шаг 4: frontend использует user-ставку 130, остальные — global.
  assert.equal(frontend.hourly_rate, 130);
  assert.equal(pm.hourly_rate, 100);
  assertClose(pm.cost, 2250);
  assertClose(frontend.cost, 4387.5);
  assertClose(backend.cost, 4455);
  assertClose(qa.cost, 1800);
  // Итог = сумма ролей + фикс кастомного сервиса (без умножения).
  assertClose(result.total_cost, 17892.5);

  // Шаг 5: календарные дни = 108.45 / (5 человек × 8)
  assertClose(result.calendar_days, 2.71125);
});

// --- Special case from ТЗ 7.3: zero technology coefficient (task #45) ---

test("коэффициент технологии 0 обнуляет скорректированные часы роли", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "react", backend: "", database: "", mobile: null },
    team: [{ role: "frontend_developer", count: 1 }],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 40, fixed_cost: null }],
    globalRates: [{ role: "frontend_developer", hourly_rate: 100 }],
    technologyCoefficients: [{ technology_key: "react", coefficient: 0 }],
  };

  const result = calculateProject(input, references);

  const frontend = result.roles[0];
  assertClose(frontend.base_hours, 40);
  assert.equal(frontend.coefficient, 0);
  assert.equal(frontend.adjusted_hours, 0);
  assert.equal(frontend.cost, 0);
  assert.equal(result.total_adjusted_hours, 0);
  assert.equal(result.total_cost, 0);
  assert.equal(result.calendar_days, 0);
});

// --- Determinism: N runs stay stable (task #47) ---

test("детерминированность: 100 прогонов дают идентичные результаты без дрейфа", () => {
  const input: CalculateInput = {
    services: ["web_app", "auth"],
    technologies: {
      frontend: "react",
      backend: "node_js",
      database: "postgresql",
      mobile: null,
    },
    team: [
      { role: "project_manager", count: 1, weight: 3 },
      { role: "frontend_developer", count: 2, weight: 5 },
      { role: "backend_developer", count: 1, weight: 2 },
      { role: "qa_engineer", count: 1, weight: 1 },
    ],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [
      { service_key: "web_app", hours: 80, fixed_cost: null },
      { service_key: "auth", hours: 20, fixed_cost: null },
    ],
    globalRates: [
      { role: "project_manager", hourly_rate: 100 },
      { role: "frontend_developer", hourly_rate: 120 },
      { role: "backend_developer", hourly_rate: 150 },
      { role: "qa_engineer", hourly_rate: 80 },
    ],
    technologyCoefficients: [
      { technology_key: "react", coefficient: 1.5 },
      { technology_key: "node_js", coefficient: 1.2 },
      { technology_key: "postgresql", coefficient: 1.1 },
    ],
  };

  const first = calculateProject(input, references);
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(calculateProject(input, references), first);
  }

  // Каждый прогон возвращает новые объекты, но те же значения.
  assertClose(first.total_base_hours, 100);
  assertClose(first.total_adjusted_hours, 1414 / 11);
});
