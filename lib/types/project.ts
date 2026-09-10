export interface RoleCost {
  role: string;
  label: string;
  hourly_rate: number;
  base_hours: number;
  coefficient: number;
  adjusted_hours: number;
  cost: number;
  count: number;
  weight: number;
}

export interface ServiceCost {
  key: string;
  label: string;
  hours: number;
  cost: number | null;
  is_custom: boolean;
}

export interface CalculationResult {
  version: string;
  total_base_hours: number;
  total_adjusted_hours: number;
  total_cost: number;
  calendar_days: number;
  roles: RoleCost[];
  services: ServiceCost[];
  custom_service_fixed_cost: number;
}

export interface ProjectData {
  name: string;
  description: string;
  selectedServices: string[];
  technology: {
    frontend: string;
    backend: string;
    database: string;
    mobile: string;
  };
  teamRoles: Array<{ role: string; label: string; count: number }>;
}

export interface CalculateInput {
  services: string[];
  technologies: {
    frontend: string;
    backend: string;
    database: string;
    mobile?: string | null;
  };
  team: Array<{ role: string; count: number; weight?: number }>;
}

export interface RateReference {
  role: string;
  hourly_rate: number;
}

export interface ServiceHoursReference {
  service_key: string;
  hours: number;
  fixed_cost: number | null;
}

export interface CustomServiceReference {
  id: string;
  name: string;
  hours: number;
  fixed_cost: number | null;
}

export interface TechnologyCoefficientReference {
  technology_key: string;
  coefficient: number;
}

export interface CalculationReferences {
  globalRates: RateReference[];
  userRates: RateReference[];
  globalServiceHours: ServiceHoursReference[];
  userServiceHours: ServiceHoursReference[];
  customServices: CustomServiceReference[];
  technologyCoefficients: TechnologyCoefficientReference[];
}
