import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type GlobalRate = Database["public"]["Tables"]["global_rates"]["Row"];
type GlobalServiceHour = Database["public"]["Tables"]["global_service_hours"]["Row"];
type UserServiceHour = Database["public"]["Tables"]["user_service_hours"]["Row"];
type CustomService = Database["public"]["Tables"]["custom_services"]["Row"];
type TechCoeff = Database["public"]["Tables"]["technology_coefficients"]["Row"];
type UserRate = Database["public"]["Tables"]["user_rates"]["Row"];

interface TeamRole {
  role: string;
  count: number;
}

interface CalculateInput {
  services: string[];
  technologies: {
    frontend: string;
    backend: string;
    database: string;
    mobile?: string | null;
  };
  team: TeamRole[];
}

interface RoleResult {
  role: string;
  label: string;
  hourly_rate: number;
  base_hours: number;
  coefficient: number;
  adjusted_hours: number;
  cost: number;
  count: number;
}

interface ServiceResult {
  key: string;
  label: string;
  hours: number;
  cost: number | null;
  is_custom: boolean;
}

export interface CalculateResult {
  total_base_hours: number;
  total_adjusted_hours: number;
  total_cost: number;
  calendar_days: number;
  roles: RoleResult[];
  services: ServiceResult[];
  custom_service_fixed_cost: number;
}

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

export async function calculateProject(
  userId: string,
  input: CalculateInput
): Promise<CalculateResult> {
  const supabase = await createClient();

  // --- Fetch all needed data ---

  // Global rates
  const { data: globalRates } = await supabase
    .from("global_rates")
    .select("*");

  // Global service hours
  const { data: globalServiceHours } = await supabase
    .from("global_service_hours")
    .select("*");

  // User rates
  const { data: userRates } = await supabase
    .from("user_rates")
    .select("*")
    .eq("user_id", userId);

  // User service hours
  const { data: userServiceHours } = await supabase
    .from("user_service_hours")
    .select("*")
    .eq("user_id", userId);

  // Custom services (user's own + global)
  const { data: customServices } = await supabase
    .from("custom_services")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`);

  // Technology coefficients
  const { data: techCoeffs } = await supabase
    .from("technology_coefficients")
    .select("*");

  // --- Build lookup maps ---

  const globalRateMap = new Map<string, number>();
  (globalRates ?? []).forEach((r: GlobalRate) => globalRateMap.set(r.role, r.hourly_rate));

  const globalHoursMap = new Map<string, { hours: number; fixed_cost: number | null }>();
  (globalServiceHours ?? []).forEach((s: GlobalServiceHour) =>
    globalHoursMap.set(s.service_key, { hours: s.hours, fixed_cost: s.fixed_cost })
  );

  const userRateMap = new Map<string, number>();
  (userRates ?? []).forEach((r: UserRate) => userRateMap.set(r.role, r.hourly_rate));

  const userHoursMap = new Map<string, { hours: number; fixed_cost: number | null }>();
  (userServiceHours ?? []).forEach((s: UserServiceHour) =>
    userHoursMap.set(s.service_key, { hours: s.hours, fixed_cost: s.fixed_cost })
  );

  const customServiceMap = new Map<string, CustomService>();
  (customServices ?? []).forEach((s: CustomService) => customServiceMap.set(s.id, s));

  const techCoeffMap = new Map<string, number>();
  (techCoeffs ?? []).forEach((c: TechCoeff) => techCoeffMap.set(c.technology_key, c.coefficient));

  // --- Step 1: Calculate total_base_hours ---

  let totalBaseHours = 0;
  const services: ServiceResult[] = [];

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

  // --- Step 2: Distribute hours evenly across active roles ---

  const activeRoles = input.team.filter((r) => r.count > 0);
  const numRoles = activeRoles.length;
  const baseHoursPerRole = numRoles > 0 ? totalBaseHours / numRoles : 0;

  // --- Step 3: Apply technology coefficients ---

  const roles: RoleResult[] = [];
  let totalAdjustedHours = 0;

  for (const teamRole of activeRoles) {
    // Determine coefficient for this role
    let coefficient = 1.0;

    // Collect all selected tech keys
    const selectedTechs = [
      input.technologies.frontend,
      input.technologies.backend,
      input.technologies.database,
      input.technologies.mobile,
    ].filter(Boolean) as string[];

    // Find techs that affect this role
    for (const techKey of selectedTechs) {
      const affectedRoles = TECH_ROLE_MAP[techKey] ?? [];
      if (affectedRoles.includes(teamRole.role)) {
        const coeff = techCoeffMap.get(techKey) ?? 1.0;
        coefficient *= coeff; // Multiply if multiple techs affect the same role
      }
    }

    const adjustedHours = baseHoursPerRole * coefficient;
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
      base_hours: baseHoursPerRole,
      coefficient,
      adjusted_hours: adjustedHours,
      cost,
      count: teamRole.count,
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
    total_base_hours: totalBaseHours,
    total_adjusted_hours: totalAdjustedHours,
    total_cost: totalCost,
    calendar_days: calendarDays,
    roles,
    services,
    custom_service_fixed_cost: customServiceFixedCost,
  };
}
