export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_logs: {
        Row: {
          call_count: number
          call_date: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          call_count?: number
          call_date?: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          call_count?: number
          call_date?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      concerns: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          raised_by: string
          resolved: boolean | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          lead_id: string
          raised_by: string
          resolved?: boolean | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          raised_by?: string
          resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "concerns_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      followups: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          notes: string
          user_id: string
          way_of_contact: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          notes: string
          user_id: string
          way_of_contact?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string
          user_id?: string
          way_of_contact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      lead_closures: {
        Row: {
          created_at: string
          id: string
          interview_plan: boolean
          lead_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          plan: Database["public"]["Enums"]["plan_type"]
          slot1: boolean | null
          slot1_amount: number | null
          slot2: boolean | null
          slot2_amount: number | null
          upfront_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          interview_plan?: boolean
          lead_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          plan: Database["public"]["Enums"]["plan_type"]
          slot1?: boolean | null
          slot1_amount?: number | null
          slot2?: boolean | null
          slot2_amount?: number | null
          upfront_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          interview_plan?: boolean
          lead_id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          plan?: Database["public"]["Enums"]["plan_type"]
          slot1?: boolean | null
          slot1_amount?: number | null
          slot2?: boolean | null
          slot2_amount?: number | null
          upfront_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_closures_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          comment: string | null
          concern: boolean | null
          created_at: string
          date: string
          display_id: string | null
          email: string
          highlight_color: string | null
          lead_category: Database["public"]["Enums"]["lead_category"] | null
          lead_generated_by: string | null
          lead_source: string | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          lead_type: Database["public"]["Enums"]["lead_type"] | null
          linkedin_url: string | null
          name: string
          phone: string
          referee_name: string | null
          resume_url: string | null
          technology: string | null
          time_for_call: string | null
          timezone: string | null
          unique_id: string
          university: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          concern?: boolean | null
          created_at?: string
          date?: string
          display_id?: string | null
          email: string
          highlight_color?: string | null
          lead_category?: Database["public"]["Enums"]["lead_category"] | null
          lead_generated_by?: string | null
          lead_source?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          linkedin_url?: string | null
          name: string
          phone: string
          referee_name?: string | null
          resume_url?: string | null
          technology?: string | null
          time_for_call?: string | null
          timezone?: string | null
          unique_id?: string
          university?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          concern?: boolean | null
          created_at?: string
          date?: string
          display_id?: string | null
          email?: string
          highlight_color?: string | null
          lead_category?: Database["public"]["Enums"]["lead_category"] | null
          lead_generated_by?: string | null
          lead_source?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          linkedin_url?: string | null
          name?: string
          phone?: string
          referee_name?: string | null
          resume_url?: string | null
          technology?: string | null
          time_for_call?: string | null
          timezone?: string | null
          unique_id?: string
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "ADMIN"
        | "PROCESS_ANALYST"
        | "LEAD_TL"
        | "LEAD_GEN"
        | "SALES_TL"
        | "SALES_TM"
      lead_category: "Hot" | "Cold"
      lead_status:
        | "New"
        | "DNR1"
        | "DNR2"
        | "DNR3"
        | "Connected"
        | "Qualified"
        | "Hot Prospect"
        | "Closed"
        | "Non Interested"
      lead_type: "New" | "Reference"
      payment_mode:
        | "Cash"
        | "Card"
        | "UPI"
        | "Bank Transfer"
        | "Other"
        | "Stripe"
      plan_type: "Starter" | "Premium" | "Elite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "ADMIN",
        "PROCESS_ANALYST",
        "LEAD_TL",
        "LEAD_GEN",
        "SALES_TL",
        "SALES_TM",
      ],
      lead_category: ["Hot", "Cold"],
      lead_status: [
        "New",
        "DNR1",
        "DNR2",
        "DNR3",
        "Connected",
        "Qualified",
        "Hot Prospect",
        "Closed",
        "Non Interested",
      ],
      lead_type: ["New", "Reference"],
      payment_mode: ["Cash", "Card", "UPI", "Bank Transfer", "Other", "Stripe"],
      plan_type: ["Starter", "Premium", "Elite"],
    },
  },
} as const
