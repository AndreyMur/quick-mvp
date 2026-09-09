export interface RoleCost {
  role: string;
  label: string;
  hourly_rate: number;
  base_hours: number;
  coefficient: number;
  adjusted_hours: number;
  cost: number;
  count: number;
}

export interface ServiceCost {
  key: string;
  label: string;
  hours: number;
  cost: number | null;
  is_custom: boolean;
}

export interface CalculationResult {
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
