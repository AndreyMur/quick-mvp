export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          is_admin: boolean;
          subscription_tier: string;
          project_limit: number;
          custom_services_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          is_admin?: boolean;
          subscription_tier?: string;
          project_limit?: number;
          custom_services_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          is_admin?: boolean;
          subscription_tier?: string;
          project_limit?: number;
          custom_services_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          status: string;
          provider: string | null;
          provider_subscription_id: string | null;
          provider_customer_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string;
          status?: string;
          provider?: string | null;
          provider_subscription_id?: string | null;
          provider_customer_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: string;
          status?: string;
          provider?: string | null;
          provider_subscription_id?: string | null;
          provider_customer_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          type: string | null;
          user_id: string | null;
          payload: Json | null;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          event_id: string;
          type?: string | null;
          user_id?: string | null;
          payload?: Json | null;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_id?: string;
          type?: string | null;
          user_id?: string | null;
          payload?: Json | null;
          processed_at?: string;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          data: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          data?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          data?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      global_rates: {
        Row: {
          id: string;
          role: string;
          hourly_rate: number;
        };
        Insert: {
          id?: string;
          role: string;
          hourly_rate: number;
        };
        Update: {
          id?: string;
          role?: string;
          hourly_rate?: number;
        };
      };
      global_service_hours: {
        Row: {
          id: string;
          service_key: string;
          hours: number;
          fixed_cost: number | null;
        };
        Insert: {
          id?: string;
          service_key: string;
          hours: number;
          fixed_cost?: number | null;
        };
        Update: {
          id?: string;
          service_key?: string;
          hours?: number;
          fixed_cost?: number | null;
        };
      };
      user_rates: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          hourly_rate: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          hourly_rate: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          hourly_rate?: number;
        };
      };
      user_service_hours: {
        Row: {
          id: string;
          user_id: string;
          service_key: string;
          hours: number;
          fixed_cost: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          service_key: string;
          hours: number;
          fixed_cost?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          service_key?: string;
          hours?: number;
          fixed_cost?: number | null;
        };
      };
      custom_services: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          hours: number;
          fixed_cost: number | null;
          icon_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          hours: number;
          fixed_cost?: number | null;
          icon_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          hours?: number;
          fixed_cost?: number | null;
          icon_url?: string | null;
          created_at?: string;
        };
      };
      technology_coefficients: {
        Row: {
          id: string;
          technology_key: string;
          coefficient: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          technology_key: string;
          coefficient?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          technology_key?: string;
          coefficient?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
