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
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value?: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      contract_files: {
        Row: {
          contract_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_current: boolean
          uploaded_at: string
        }
        Insert: {
          contract_id: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          is_current?: boolean
          uploaded_at?: string
        }
        Update: {
          contract_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_current?: boolean
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_files_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_history: {
        Row: {
          change_type: string
          changed_by: string | null
          contract_id: string
          created_at: string
          id: string
          new_value: string
          previous_value: string | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          contract_id: string
          created_at?: string
          id?: string
          new_value: string
          previous_value?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          new_value?: string
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          expiration_date: string
          id: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          supplier_id: string
          supplier_name: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiration_date: string
          id?: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id: string
          supplier_name: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiration_date?: string
          id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          supplier_id?: string
          supplier_name?: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Relationships: []
      }
      non_conformities: {
        Row: {
          created_at: string
          description: string
          id: string
          project_number: string
          purchase_order_number: string
          result: string
          supplier_id: string
          value_of_goods_affected: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          project_number?: string
          purchase_order_number?: string
          result?: string
          supplier_id: string
          value_of_goods_affected?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_number?: string
          purchase_order_number?: string
          result?: string
          supplier_id?: string
          value_of_goods_affected?: number
        }
        Relationships: [
          {
            foreignKeyName: "non_conformities_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          supplier_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          supplier_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          supplier_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          certifications: Json
          created_at: string
          email: string
          id: string
          insurances: Json
          name: string
          risk_category: number
          terms_and_conditions: Json
        }
        Insert: {
          active?: boolean
          certifications?: Json
          created_at?: string
          email?: string
          id: string
          insurances?: Json
          name: string
          risk_category?: number
          terms_and_conditions?: Json
        }
        Update: {
          active?: boolean
          certifications?: Json
          created_at?: string
          email?: string
          id?: string
          insurances?: Json
          name?: string
          risk_category?: number
          terms_and_conditions?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer" | "editor"
      contract_status: "Active" | "Expired" | "Expiring Soon"
      contract_type:
        | "Water"
        | "Electric"
        | "Waste"
        | "Catering"
        | "Banking"
        | "Telephony"
        | "System Integrator"
        | "IT Services"
        | "Facility Management"
        | "Legal"
        | "Marketing"
        | "Insurance"
        | "Consulting"
        | "Logistics"
        | "Human Resources"
        | "Software Licensing"
        | "Security Services"
        | "Travel & Expense"
        | "Office Supplies"
        | "Recruitment"
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
      app_role: ["admin", "viewer", "editor"],
      contract_status: ["Active", "Expired", "Expiring Soon"],
      contract_type: [
        "Water",
        "Electric",
        "Waste",
        "Catering",
        "Banking",
        "Telephony",
        "System Integrator",
        "IT Services",
        "Facility Management",
        "Legal",
        "Marketing",
        "Insurance",
        "Consulting",
        "Logistics",
        "Human Resources",
        "Software Licensing",
        "Security Services",
        "Travel & Expense",
        "Office Supplies",
        "Recruitment",
      ],
    },
  },
} as const
