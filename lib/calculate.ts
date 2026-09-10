import type {
  CalculateInput,
  CalculationReferences,
  CalculationResult,
  RoleCost,
  ServiceCost,
} from "@/lib/types/project";

/**
 * Version of the calculation algorithm. Bumped whenever the core changes in a
 * way that may alter results, so snapshots can be interpreted unambiguously.
 */
export const CALCULATION_VERSION = "2.0.0";

// Map role keys to display labels
const ROLE_LABELS: Record<string, string> = {
  project_manager: "Project Manager",
  frontend_developer: "Frontend Developer",
  backend_developer: "Backend Developer",
  mobile_developer: "Mobile Developer",
  qa_engineer: "QA Engineer",
  devops: "DevOps",
  ui_ux_designer: "UI/UX Designer",
};

// Which technology keys affect which roles
const TECH_ROLE_MAP: Record<string, string[]> = {
  react: ["frontend_developer"],
  vue: ["frontend_developer"],
  angular: ["frontend_developer"],
  node_js: ["backend_developer"],
  python: ["backend_developer"],
  ruby: ["backend_developer"],
  php: ["backend_developer"],
  postgresql: ["backend_developer"],
  mysql: ["backend_developer"],
  mongodb: ["backend_developer"],
  react_native: ["mobile_developer"],
  flutter: ["mobile_developer"],
  native_ios: ["mobile_developer"],
  native_android: ["mobile_developer"],
};

/**
 * Pure calculation core: no I/O, no database access.
 * All reference data (rates, norms, coefficients) is passed in explicitly.
 */
export function calculateProject(
  input: CalculateInput,
  references: CalculationReferences
): CalculationResult {
  // --- Build lookup maps from the provided references ---

  const globalRateMap = new Map<string, number>();
  references.globalRates.forEach((r) => globalRateMap.set(r.role, r.hourly_rate));

  const globalHoursMap = new Map<string, { hours: number; fixed_cost: number | null }>();
  references.globalServiceHours.forEach((s) =>
    globalHoursMap.set(s.service_key, { hours: s.hours, fixed_cost: s.fixed_cost })
  );

  const userRateMap = new Map<string, number>();
  references.userRates.forEach((r) => userRateMap.set(r.role, r.hourly_rate));

  const userHoursMap = new Map<string, { hours: number; fixed_cost: number | null }>();
  references.userServiceHours.forEach((s) =>
    userHoursMap.set(s.service_key, { hours: s.hours, fixed_cost: s.fixed_cost })
  );

  const customServiceMap = new Map<string, { name: string; hours: number; fixed_cost: number | null }>();
  references.customServices.forEach((s) =>
    customServiceMap.set(s.id, { name: s.name, hours: s.hours, fixed_cost: s.fixed_cost })
  );

  const techCoeffMap = new Map<string, number>();
  references.technologyCoefficients.forEach((c) =>
    techCoeffMap.set(c.technology_key, c.coefficient)
  );

  // --- Step 1: Calculate total_base_hours ---

  let totalBaseHours = 0;
  const services: ServiceCost[] = [];

  for (const serviceKey of input.services) {
    const customService = customServiceMap.get(serviceKey);

    if (customService) {
      // Custom service: use hours from custom_services
      totalBaseHours += customService.hours;
      services.push({
        key: serviceKey,
        label: customService.name,
        hours: customService.hours,
        cost: customService.fixed_cost,
        is_custom: true,
      });
    } else {
      // Standard service: user hours → global hours
      const userHours = userHoursMap.get(serviceKey);
      const globalHours = globalHoursMap.get(serviceKey);
      const hours = userHours?.hours ?? globalHours?.hours ?? 0;
      const fixedCost = userHours?.fixed_cost ?? globalHours?.fixed_cost ?? null;

      totalBaseHours += hours;
      services.push({
        key: serviceKey,
        label: serviceKey,
        hours,
        cost: fixedCost,
        is_custom: false,
      });
    }
  }

  // --- Step 2: Distribute hours across active roles proportionally to weights ---

  const activeRoles = input.team.filter((r) => r.count > 0);

  // Normalize weights: missing/non-positive values become 0, omitted weight means 1.
  const rawWeights = activeRoles.map((r) =>
    r.weight === undefined ? 1 : r.weight > 0 && Number.isFinite(r.weight) ? r.weight : 0
  );
  let weightSum = rawWeights.reduce((sum, w) => sum + w, 0);

  // Explicit fallback: a zero (or invalid) total weight must not break the
  // calculation — fall back to an even distribution, i.e. the legacy behavior.
  const weights =
    weightSum > 0 ? rawWeights : activeRoles.map(() => 1);
  if (weightSum <= 0) {
    weightSum = weights.length;
  }

  const baseHoursPerRole = (weight: number) =>
    weightSum > 0 ? (totalBaseHours * weight) / weightSum : 0;

  // --- Step 3: Apply technology coefficients ---

  const roles: RoleCost[] = [];
  let totalAdjustedHours = 0;

  // Collect all selected tech keys once
  const selectedTechs = [
    input.technologies.frontend,
    input.technologies.backend,
    input.technologies.database,
    input.technologies.mobile,
  ].filter(Boolean) as string[];

  for (let i = 0; i < activeRoles.length; i++) {
    const teamRole = activeRoles[i];
    const weight = weights[i];
    const roleBaseHours = baseHoursPerRole(weight);

    // Determine coefficient for this role
    let coefficient = 1.0;

    // Find techs that affect this role
    for (const techKey of selectedTechs) {
      const affectedRoles = TECH_ROLE_MAP[techKey] ?? [];
      if (affectedRoles.includes(teamRole.role)) {
        const coeff = techCoeffMap.get(techKey) ?? 1.0;
        coefficient *= coeff; // Multiply if multiple techs affect the same role
      }
    }

    const adjustedHours = roleBaseHours * coefficient;
    totalAdjustedHours += adjustedHours;

    // Get rate: user rate → global rate
    const userRate = userRateMap.get(teamRole.role);
    const globalRate = globalRateMap.get(teamRole.role) ?? 0;
    const hourlyRate = userRate ?? globalRate;

    const cost = adjustedHours * hourlyRate;

    roles.push({
      role: teamRole.role,
      label: ROLE_LABELS[teamRole.role] ?? teamRole.role,
      hourly_rate: hourlyRate,
      base_hours: roleBaseHours,
      coefficient,
      adjusted_hours: adjustedHours,
      cost,
      count: teamRole.count,
      weight,
    });
  }

  // --- Step 4: Calculate total cost ---

  const totalRoleCost = roles.reduce((sum, r) => sum + r.cost, 0);

  // Add fixed costs from custom services
  let customServiceFixedCost = 0;
  for (const svc of services) {
    if (svc.is_custom && svc.cost) {
      customServiceFixedCost += svc.cost;
    }
  }

  const totalCost = totalRoleCost + customServiceFixedCost;

  // Calendar time: total adjusted hours / (total people * 8 hours/day)
  const totalPeople = activeRoles.reduce((sum, r) => sum + r.count, 0);
  const calendarDays = totalPeople > 0 ? totalAdjustedHours / (totalPeople * 8) : 0;

  return {
    version: CALCULATION_VERSION,
    total_base_hours: totalBaseHours,
    total_adjusted_hours: totalAdjustedHours,
    total_cost: totalCost,
    calendar_days: calendarDays,
    roles,
    services,
    custom_service_fixed_cost: customServiceFixedCost,
  };
}
