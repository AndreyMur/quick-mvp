import { test } from "node:test";
import assert from "node:assert/strict";
import {
  useProjectBuilder,
  normalizeTeamRoles,
  isTeamSelectionValid,
} from "../lib/stores/project-builder.ts";
import type { TeamRole } from "../lib/stores/project-builder.ts";

function role(partial: Partial<TeamRole> & { role: string }): TeamRole {
  return { label: partial.role, count: 0, weight: 1, ...partial };
}

// --- Step validation: sum of weights > 0 (task #38) ---

test("шаг 4 валиден, когда сумма весов активных ролей больше нуля", () => {
  assert.equal(
    isTeamSelectionValid([
      role({ role: "frontend_developer", count: 1, weight: 2 }),
      role({ role: "qa_engineer", count: 1, weight: 0 }),
    ]),
    true
  );
});

test("шаг 4 невалиден при нулевой сумме весов активных ролей", () => {
  assert.equal(
    isTeamSelectionValid([
      role({ role: "frontend_developer", count: 1, weight: 0 }),
      role({ role: "qa_engineer", count: 2, weight: 0 }),
    ]),
    false
  );
});

test("шаг 4 невалиден без активных ролей", () => {
  assert.equal(
    isTeamSelectionValid([
      role({ role: "frontend_developer", count: 0, weight: 5 }),
    ]),
    false
  );
});

test("canProceed на шаге 4 требует ненулевую сумму весов", () => {
  const store = useProjectBuilder.getState();
  store.reset();
  store.setCurrentStep(4);

  assert.equal(useProjectBuilder.getState().canProceed(), true);

  for (const r of useProjectBuilder.getState().teamRoles) {
    useProjectBuilder.getState().setTeamRoleWeight(r.role, 0);
  }
  assert.equal(useProjectBuilder.getState().canProceed(), false);

  useProjectBuilder
    .getState()
    .setTeamRoleWeight("frontend_developer", 3);
  assert.equal(useProjectBuilder.getState().canProceed(), true);
});

// --- Normalization of legacy state without weights (task #39) ---

test("старый формат ролей без весов получает вес 1", () => {
  const legacy = [
    { role: "frontend_developer", label: "Frontend Developer", count: 2 },
    { role: "qa_engineer", label: "QA Engineer", count: 1 },
  ];

  const normalized = normalizeTeamRoles(legacy);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].weight, 1);
  assert.equal(normalized[0].count, 2);
  assert.equal(normalized[1].weight, 1);
});

test("сохранённые веса не перезаписываются при нормализации", () => {
  const stored = [
    { role: "frontend_developer", label: "Frontend Developer", count: 1, weight: 3 },
  ];

  const normalized = normalizeTeamRoles(stored);

  assert.equal(normalized[0].weight, 3);
});

test("нераспознанные роли отбрасываются, а не роняют нормализацию", () => {
  const normalized = normalizeTeamRoles([
    { role: "frontend_developer", count: 1, weight: 2 },
    null,
    "nonsense",
    { label: "No role", count: 1 },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].role, "frontend_developer");
});

test("отсутствие данных даёт роли по умолчанию с весом 1", () => {
  const normalized = normalizeTeamRoles(undefined);

  assert.ok(normalized.length > 0);
  assert.ok(normalized.every((r) => r.weight === 1));
});

// --- State save/restore (task #39) ---

test("hydrate восстанавливает веса из сохранённого проекта", () => {
  const store = useProjectBuilder.getState();
  store.reset();

  store.hydrate({
    teamRoles: [
      { role: "frontend_developer", label: "Frontend Developer", count: 1, weight: 4 },
      { role: "backend_developer", label: "Backend Developer", count: 1, weight: 1 },
    ],
  });

  const roles = useProjectBuilder.getState().teamRoles;
  assert.equal(roles[0].weight, 4);
  assert.equal(roles[1].weight, 1);
});

test("hydrate старого проекта без весов даёт вес 1 (совместимость)", () => {
  const store = useProjectBuilder.getState();
  store.reset();

  store.hydrate({
    teamRoles: [
      { role: "frontend_developer", label: "Frontend Developer", count: 1 },
    ] as unknown as TeamRole[],
  });

  const roles = useProjectBuilder.getState().teamRoles;
  assert.equal(roles.length, 1);
  assert.equal(roles[0].weight, 1);
});

test("setTeamRoleWeight обновляет только выбранную роль и не уходит ниже нуля", () => {
  const store = useProjectBuilder.getState();
  store.reset();

  store.setTeamRoleWeight("frontend_developer", 5);
  store.setTeamRoleWeight("qa_engineer", -3);

  const roles = useProjectBuilder.getState().teamRoles;
  const frontend = roles.find((r) => r.role === "frontend_developer");
  const qa = roles.find((r) => r.role === "qa_engineer");
  const pm = roles.find((r) => r.role === "project_manager");

  assert.equal(frontend?.weight, 5);
  assert.equal(qa?.weight, 0);
  assert.equal(pm?.weight, 1);
});
