import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateProject,
  normalizeCalculationResult,
  CALCULATION_VERSION,
  LEGACY_CALCULATION_VERSION,
} from "../lib/calculate.ts";
import { calculateInputSchema } from "../lib/validations/calculate.ts";
import { updateProjectSchema } from "../lib/validations/project.ts";
import { openApiDocument } from "../lib/openapi.ts";
import type {
  CalculateInput,
  CalculationReferences,
} from "../lib/types/project.ts";

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

// --- Legacy snapshot compatibility (task #35) ---

test("снапшот старого формата без версии открывается и получает legacy-версию", () => {
  const legacySnapshot = {
    total_base_hours: 90,
    total_adjusted_hours: 90,
    total_cost: 9000,
    calendar_days: 3.75,
    roles: [
      {
        role: "frontend_developer",
        label: "Frontend Developer",
        hourly_rate: 100,
        base_hours: 45,
        coefficient: 1,
        adjusted_hours: 45,
        cost: 4500,
        count: 1,
      },
    ],
    services: [
      { key: "web_app", label: "web_app", hours: 90, cost: null, is_custom: false },
    ],
    custom_service_fixed_cost: 0,
  };

  const result = normalizeCalculationResult(legacySnapshot);

  assert.ok(result);
  assert.equal(result.version, LEGACY_CALCULATION_VERSION);
  assert.equal(result.roles[0].weight, 1);
  assert.equal(result.total_cost, 9000);
});

test("актуальный снапшот сохраняет версию и веса без изменений", () => {
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

  const fresh = calculateProject(input, references);
  const normalized = normalizeCalculationResult(fresh);

  assert.deepEqual(normalized, fresh);
  assert.equal(normalized?.version, CALCULATION_VERSION);
  assert.equal(normalized?.roles[0].weight, 3);
});

test("нераспознанный снапшот не роняет страницу (возвращает null)", () => {
  assert.equal(normalizeCalculationResult(null), null);
  assert.equal(normalizeCalculationResult("not a snapshot"), null);
  assert.equal(normalizeCalculationResult({ roles: [], services: [] }), null);
  assert.equal(normalizeCalculationResult({ roles: "x", services: [] }), null);
});

// --- API contract compatibility (task #36) ---

test("payload /api/calculate со страницы результата валиден по контракту", () => {
  const payload = {
    services: ["web_app"],
    technologies: { frontend: "react", backend: "node_js", database: "postgresql", mobile: "" },
    team: [
      { role: "frontend_developer", count: 1 },
      { role: "backend_developer", count: 2 },
    ],
  };

  const parsed = calculateInputSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("контракт /api/calculate отклоняет пустой выбор сервисов и ролей", () => {
  assert.equal(
    calculateInputSchema.safeParse({
      services: [],
      technologies: { frontend: "react", backend: "node_js", database: "postgresql" },
      team: [{ role: "frontend_developer", count: 1 }],
    }).success,
    false
  );
  assert.equal(
    calculateInputSchema.safeParse({
      services: ["web_app"],
      technologies: { frontend: "react", backend: "node_js", database: "postgresql" },
      team: [],
    }).success,
    false
  );
});

test("payload сохранения проекта со страницы результата валиден по контракту", () => {
  const input: CalculateInput = {
    services: ["web_app"],
    technologies: { frontend: "react", backend: "node_js", database: "postgresql", mobile: "" },
    team: [{ role: "frontend_developer", count: 1 }],
  };
  const references: CalculationReferences = {
    ...emptyReferences(),
    globalServiceHours: [{ service_key: "web_app", hours: 40, fixed_cost: null }],
  };
  const result = calculateProject(input, references);

  const payload = {
    name: "Проект",
    description: "",
    status: "completed",
    data: {
      name: "Проект",
      description: "",
      selectedServices: input.services,
      technology: input.technologies,
      teamRoles: [{ role: "frontend_developer", label: "Frontend Developer", count: 1 }],
      result,
    },
  };

  const parsed = updateProjectSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("результат расчёта содержит все поля контракта CalculationResult", () => {
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
  const requiredKeys = [
    "version",
    "total_base_hours",
    "total_adjusted_hours",
    "total_cost",
    "calendar_days",
    "roles",
    "services",
    "custom_service_fixed_cost",
  ] as const;

  for (const key of requiredKeys) {
    assert.ok(key in result, `missing key ${key}`);
  }
});

// --- OpenAPI schema sync (task #37) ---

test("OpenAPI отражает версию расчёта, веса ролей и снапшот проекта", () => {
  const schemas = openApiDocument.components.schemas;

  assert.ok(schemas.CalculationResult.properties.version);
  assert.ok(schemas.CalculationRole.properties.weight);
  assert.ok(schemas.TeamSelection.properties.weight);
  assert.ok(schemas.CalculateRequest.properties.technologies);
  assert.ok(schemas.ProjectData, "ProjectData schema is missing");
  assert.ok(schemas.ProjectData.properties.result);
  assert.ok(schemas.ProjectData.properties.teamRoles);
});
