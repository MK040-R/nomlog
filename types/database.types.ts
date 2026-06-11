export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      meal_logs: {
        Row: {
          id: string
          user_id: string
          logged_at: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          raw_input: string | null
          food_items: Json
          total_calories: number
          total_protein_g: number
          total_carbs_g: number
          total_fat_g: number
          total_fiber_g: number
          confidence: 'high' | 'medium' | 'low' | null
          input_source: 'voice' | 'text' | null
          edited: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          logged_at?: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          raw_input?: string | null
          food_items?: Json
          total_calories?: number
          total_protein_g?: number
          total_carbs_g?: number
          total_fat_g?: number
          total_fiber_g?: number
          confidence?: 'high' | 'medium' | 'low' | null
          input_source?: 'voice' | 'text' | null
          edited?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['meal_logs']['Insert']>
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          user_id: string
          logged_on: string
          weight_kg: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          logged_on: string
          weight_kg: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['weight_logs']['Insert']>
        Relationships: []
      }
      daily_tips: {
        Row: {
          id: string
          user_id: string
          tip_date: string
          tip: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tip_date: string
          tip: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['daily_tips']['Insert']>
        Relationships: []
      }
      weekly_recaps: {
        Row: {
          id: string
          user_id: string
          week_start: string
          recap: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          recap: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['weekly_recaps']['Insert']>
        Relationships: []
      }
      favorite_meals: {
        Row: {
          id: string
          user_id: string
          sig: string
          label: string
          items: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sig: string
          label: string
          items?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['favorite_meals']['Insert']>
        Relationships: []
      }
      water_logs: {
        Row: {
          id: string
          user_id: string
          logged_on: string
          glasses: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          logged_on: string
          glasses?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['water_logs']['Insert']>
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          created_at: string
          name: string | null
          age: number | null
          weight_kg: number | null
          height_cm: number | null
          goal_calories: number | null
          goal_protein_g: number | null
          goal_carbs_g: number | null
          goal_fat_g: number | null
          goal_fiber_g: number | null
          goal_weight_kg: number | null
        }
        Insert: {
          id: string
          created_at?: string
          name?: string | null
          age?: number | null
          weight_kg?: number | null
          height_cm?: number | null
          goal_calories?: number | null
          goal_protein_g?: number | null
          goal_carbs_g?: number | null
          goal_fat_g?: number | null
          goal_fiber_g?: number | null
          goal_weight_kg?: number | null
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
