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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_type: string
          attempt_number: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          incident_id: string
          output_json: Json | null
          started_at: string | null
          status: string
          summary: string | null
        }
        Insert: {
          agent_type: string
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          incident_id: string
          output_json?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          agent_type?: string
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          incident_id?: string
          output_json?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          decided_at: string
          decision: string
          id: string
          note: string | null
          recommendation_id: string
          reviewer_id: string
        }
        Insert: {
          decided_at?: string
          decision: string
          id?: string
          note?: string | null
          recommendation_id: string
          reviewer_id: string
        }
        Update: {
          decided_at?: string
          decision?: string
          id?: string
          note?: string | null
          recommendation_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: true
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string
          created_at: string
          details_json: Json
          event_type: string
          id: string
          incident_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          details_json?: Json
          event_type: string
          id?: string
          incident_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          details_json?: Json
          event_type?: string
          id?: string
          incident_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          agent_run_id: string | null
          confidence: string
          evidence_type: string
          id: string
          incident_id: string
          metadata_json: Json
          observed_at: string
          source: string
          summary: string
        }
        Insert: {
          agent_run_id?: string | null
          confidence?: string
          evidence_type: string
          id?: string
          incident_id: string
          metadata_json?: Json
          observed_at?: string
          source: string
          summary: string
        }
        Update: {
          agent_run_id?: string | null
          confidence?: string
          evidence_type?: string
          id?: string
          incident_id?: string
          metadata_json?: Json
          observed_at?: string
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          confidence: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          raw_content: string
          ref: string
          risk_level: string | null
          risk_score: number | null
          score_breakdown: Json | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          raw_content: string
          ref?: string
          risk_level?: string | null
          risk_score?: number | null
          score_breakdown?: Json | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          raw_content?: string
          ref?: string
          risk_level?: string | null
          risk_score?: number | null
          score_breakdown?: Json | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          indicator_type: string
          indicator_value: string
          normalized_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          indicator_type: string
          indicator_value: string
          normalized_value: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          indicator_type?: string
          indicator_value?: string
          normalized_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicators_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          action_type: string
          created_at: string
          id: string
          incident_id: string
          rationale: string
          simulated_result: string | null
          status: string
          title: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          incident_id: string
          rationale: string
          simulated_result?: string | null
          status?: string
          title: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          incident_id?: string
          rationale?: string
          simulated_result?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          enabled: boolean
          key: string
          label: string
          points: number
        }
        Insert: {
          enabled?: boolean
          key: string
          label: string
          points: number
        }
        Update: {
          enabled?: boolean
          key?: string
          label?: string
          points?: number
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          id: string
          indicator: string
          log_source: string
          message: string
          observed_at: string
          severity: string
        }
        Insert: {
          id?: string
          indicator: string
          log_source: string
          message: string
          observed_at?: string
          severity: string
        }
        Update: {
          id?: string
          indicator?: string
          log_source?: string
          message?: string
          observed_at?: string
          severity?: string
        }
        Relationships: []
      }
      threat_fixtures: {
        Row: {
          id: string
          kind: string
          note: string | null
          source: string
          value: string
          verdict: string
        }
        Insert: {
          id?: string
          kind: string
          note?: string | null
          source?: string
          value: string
          verdict: string
        }
        Update: {
          id?: string
          kind?: string
          note?: string | null
          source?: string
          value?: string
          verdict?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
