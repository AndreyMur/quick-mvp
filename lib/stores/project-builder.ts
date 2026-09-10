import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// --- Types ---

export interface TeamRole {
  role: string;
  label: string;
  count: number;
  weight: number;
}

export interface ProjectBuilderState {
  // Step 1: Description
  name: string;
  description: string;

  // Step 2: Services
  selectedServices: string[];

  // Step 3: Technologies
  technology: {
    frontend: string;
    backend: string;
    database: string;
    mobile: string;
  };

  // Step 4: Team
  teamRoles: TeamRole[];

  // Navigation
  currentStep: number;
  totalSteps: number;

  // Actions
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  toggleService: (serviceKey: string) => void;
  setTechnology: (
    key: "frontend" | "backend" | "database" | "mobile",
    value: string
  ) => void;
  setTeamRoleCount: (role: string, count: number) => void;
  setTeamRoleWeight: (role: string, weight: number) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canProceed: () => boolean;
  reset: () => void;
  hydrate: (data: Partial<ProjectBuilderState>) => void;
}

const defaultTeamRoles: TeamRole[] = [
  { role: "project_manager", label: "Project Manager", count: 1, weight: 1 },
  { role: "frontend_developer", label: "Frontend Developer", count: 1, weight: 1 },
  { role: "backend_developer", label: "Backend Developer", count: 1, weight: 1 },
  { role: "mobile_developer", label: "Mobile Developer", count: 0, weight: 1 },
  { role: "qa_engineer", label: "QA Engineer", count: 1, weight: 1 },
  { role: "devops", label: "DevOps", count: 0, weight: 1 },
  { role: "ui_ux_designer", label: "UI/UX Designer", count: 0, weight: 1 },
];

/**
 * Normalizes persisted/loaded team roles. Older localStorage snapshots and
 * saved projects store roles without a `weight`; those are treated as `1`
 * (legacy even distribution) instead of being dropped.
 */
export function normalizeTeamRoles(value: unknown): TeamRole[] {
  if (!Array.isArray(value)) return defaultTeamRoles;

  const normalized: TeamRole[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    if (typeof record.role !== "string" || record.role.length === 0) continue;

    const rawCount = record.count;
    const count =
      typeof rawCount === "number" && Number.isFinite(rawCount)
        ? Math.max(0, Math.floor(rawCount))
        : 0;

    const rawWeight = record.weight;
    const weight =
      typeof rawWeight === "number" && Number.isFinite(rawWeight) && rawWeight >= 0
        ? rawWeight
        : 1;

    normalized.push({
      role: record.role,
      label:
        typeof record.label === "string" && record.label.length > 0
          ? record.label
          : record.role,
      count,
      weight,
    });
  }

  return normalized;
}

/**
 * A team selection is valid when at least one active role has a positive
 * weight, i.e. the sum of weights across active roles is greater than zero.
 */
export function isTeamSelectionValid(teamRoles: TeamRole[]): boolean {
  return teamRoles.some((role) => role.count > 0 && role.weight > 0);
}

const TOTAL_STEPS = 5;

export const useProjectBuilder = create<ProjectBuilderState>()(
  persist(
    (set, get) => ({
      // Initial state
      name: "",
      description: "",
      selectedServices: [],
      technology: {
        frontend: "react",
        backend: "node_js",
        database: "postgresql",
        mobile: "",
      },
      teamRoles: defaultTeamRoles,
      currentStep: 1,
      totalSteps: TOTAL_STEPS,

      // Actions
      setName: (name) => set({ name }),
      setDescription: (description) => set({ description }),

      toggleService: (serviceKey) =>
        set((state) => {
          const exists = state.selectedServices.includes(serviceKey);
          return {
            selectedServices: exists
              ? state.selectedServices.filter((s) => s !== serviceKey)
              : [...state.selectedServices, serviceKey],
          };
        }),

      setTechnology: (key, value) =>
        set((state) => ({
          technology: { ...state.technology, [key]: value },
        })),

      setTeamRoleCount: (role, count) =>
        set((state) => ({
          teamRoles: state.teamRoles.map((r) =>
            r.role === role ? { ...r, count: Math.max(0, count) } : r
          ),
        })),

      setTeamRoleWeight: (role, weight) =>
        set((state) => ({
          teamRoles: state.teamRoles.map((r) =>
            r.role === role ? { ...r, weight: Math.max(0, weight) } : r
          ),
        })),

      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS),
        })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 1),
        })),

      canProceed: () => {
        const state = get();
        switch (state.currentStep) {
          case 1:
            return state.name.trim().length >= 1;
          case 2:
            return state.selectedServices.length > 0;
          case 3:
            return (
              state.technology.frontend.length > 0 &&
              state.technology.backend.length > 0 &&
              state.technology.database.length > 0
            );
          case 4:
            return isTeamSelectionValid(state.teamRoles);
          default:
            return true;
        }
      },

      reset: () =>
        set({
          name: "",
          description: "",
          selectedServices: [],
          technology: {
            frontend: "react",
            backend: "node_js",
            database: "postgresql",
            mobile: "",
          },
          teamRoles: defaultTeamRoles,
          currentStep: 1,
        }),

      hydrate: (data) =>
        set((state) => ({
          ...state,
          ...data,
          teamRoles: data.teamRoles
            ? normalizeTeamRoles(data.teamRoles)
            : state.teamRoles,
        })),
    }),
    {
      name: "project-builder-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        name: state.name,
        description: state.description,
        selectedServices: state.selectedServices,
        technology: state.technology,
        teamRoles: state.teamRoles,
        currentStep: state.currentStep,
      }),
      // Older persisted state has no `weight` on team roles; normalize on
      // rehydration so weights default to 1 (legacy even distribution).
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ProjectBuilderState>;
        return {
          ...currentState,
          ...persisted,
          teamRoles: normalizeTeamRoles(persisted.teamRoles),
        };
      },
    }
  )
);
