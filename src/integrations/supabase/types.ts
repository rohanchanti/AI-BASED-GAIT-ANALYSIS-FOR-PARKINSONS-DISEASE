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
      analysis_runs: {
        Row: {
          analysis_code: string | null
          analysis_mode: string | null
          attempts: number
          completed_at: string | null
          error_message: string | null
          feature_pipeline_version: string | null
          heartbeat_at: string | null
          id: string
          model_version: string | null
          owner_id: string
          platform_version: string | null
          pose_estimator_version: string | null
          preprocessing_config: Json
          progress: number
          quality_report: Json | null
          recording_id: string
          session_key: string | null
          stage: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          analysis_code?: string | null
          analysis_mode?: string | null
          attempts?: number
          completed_at?: string | null
          error_message?: string | null
          feature_pipeline_version?: string | null
          heartbeat_at?: string | null
          id?: string
          model_version?: string | null
          owner_id: string
          platform_version?: string | null
          pose_estimator_version?: string | null
          preprocessing_config?: Json
          progress?: number
          quality_report?: Json | null
          recording_id: string
          session_key?: string | null
          stage?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          analysis_code?: string | null
          analysis_mode?: string | null
          attempts?: number
          completed_at?: string | null
          error_message?: string | null
          feature_pipeline_version?: string | null
          heartbeat_at?: string | null
          id?: string
          model_version?: string | null
          owner_id?: string
          platform_version?: string | null
          pose_estimator_version?: string | null
          preprocessing_config?: Json
          progress?: number
          quality_report?: Json | null
          recording_id?: string
          session_key?: string | null
          stage?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      clinician_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          reviewer_id: string
          run_id: string
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          reviewer_id: string
          run_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          reviewer_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinician_reviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: string
          document_version: string | null
          granted: boolean
          id: string
          notes: string | null
          owner_id: string
          recorded_at: string
          subject_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consent_type: string
          document_version?: string | null
          granted: boolean
          id?: string
          notes?: string | null
          owner_id: string
          recorded_at?: string
          subject_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consent_type?: string
          document_version?: string | null
          granted?: boolean
          id?: string
          notes?: string | null
          owner_id?: string
          recorded_at?: string
          subject_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      export_log: {
        Row: {
          created_at: string
          deidentified: boolean
          format: string
          id: string
          run_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deidentified?: boolean
          format: string
          id?: string
          run_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deidentified?: boolean
          format?: string
          id?: string
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      gait_results: {
        Row: {
          created_at: string
          engine_output: Json | null
          events: Json | null
          id: string
          is_synthetic: boolean
          landmark_frames: Json | null
          landmark_summary: Json | null
          model_confidence: number | null
          model_score: number | null
          owner_id: string
          parameters: Json
          pose_metrics: Json | null
          quality: Json | null
          result_payload: Json | null
          run_id: string
          validation: Json | null
        }
        Insert: {
          created_at?: string
          engine_output?: Json | null
          events?: Json | null
          id?: string
          is_synthetic?: boolean
          landmark_frames?: Json | null
          landmark_summary?: Json | null
          model_confidence?: number | null
          model_score?: number | null
          owner_id: string
          parameters?: Json
          pose_metrics?: Json | null
          quality?: Json | null
          result_payload?: Json | null
          run_id: string
          validation?: Json | null
        }
        Update: {
          created_at?: string
          engine_output?: Json | null
          events?: Json | null
          id?: string
          is_synthetic?: boolean
          landmark_frames?: Json | null
          landmark_summary?: Json | null
          model_confidence?: number | null
          model_score?: number | null
          owner_id?: string
          parameters?: Json
          pose_metrics?: Json | null
          quality?: Json | null
          result_payload?: Json | null
          run_id?: string
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gait_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocols: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          settings: Json
          test_type: string
          updated_at: string
          version: number
          workflow: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          settings?: Json
          test_type?: string
          updated_at?: string
          version?: number
          workflow?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json
          test_type?: string
          updated_at?: string
          version?: number
          workflow?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          camera_view: string | null
          created_at: string
          deviations: string | null
          duration_sec: number | null
          fps: number | null
          height: number | null
          id: string
          mime_type: string | null
          modality: string
          original_filename: string | null
          owner_id: string
          processing_status: string
          protocol: string | null
          protocol_checks: Json | null
          size_bytes: number | null
          source: string
          storage_path: string | null
          trial_number: number | null
          visit_id: string
          walking_distance_m: number | null
          width: number | null
        }
        Insert: {
          camera_view?: string | null
          created_at?: string
          deviations?: string | null
          duration_sec?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          modality?: string
          original_filename?: string | null
          owner_id: string
          processing_status?: string
          protocol?: string | null
          protocol_checks?: Json | null
          size_bytes?: number | null
          source: string
          storage_path?: string | null
          trial_number?: number | null
          visit_id: string
          walking_distance_m?: number | null
          width?: number | null
        }
        Update: {
          camera_view?: string | null
          created_at?: string
          deviations?: string | null
          duration_sec?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          modality?: string
          original_filename?: string | null
          owner_id?: string
          processing_status?: string
          protocol?: string | null
          protocol_checks?: Json | null
          size_bytes?: number | null
          source?: string
          storage_path?: string | null
          trial_number?: number | null
          visit_id?: string
          walking_distance_m?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          age: number | null
          analysis_run_id: string | null
          confidence: number
          created_at: string
          gender: string | null
          id: string
          kind: string
          media_url: string | null
          mode: string
          parameters: Json
          patient_name: string | null
          probability: number
          risk_level: string
          user_id: string
        }
        Insert: {
          age?: number | null
          analysis_run_id?: string | null
          confidence: number
          created_at?: string
          gender?: string | null
          id?: string
          kind: string
          media_url?: string | null
          mode: string
          parameters?: Json
          patient_name?: string | null
          probability: number
          risk_level: string
          user_id: string
        }
        Update: {
          age?: number | null
          analysis_run_id?: string | null
          confidence?: number
          created_at?: string
          gender?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          mode?: string
          parameters?: Json
          patient_name?: string | null
          probability?: number
          risk_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          age: number | null
          created_at: string
          display_name: string | null
          height_cm: number | null
          id: string
          owner_id: string
          retention_status: string
          sex: string | null
          subject_code: string
          updated_at: string
          weight_kg: number | null
          workflow: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id?: string
          owner_id: string
          retention_status?: string
          sex?: string | null
          subject_code: string
          updated_at?: string
          weight_kg?: number | null
          workflow?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id?: string
          owner_id?: string
          retention_status?: string
          sex?: string | null
          subject_code?: string
          updated_at?: string
          weight_kg?: number | null
          workflow?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      visits: {
        Row: {
          clinical_scores: Json
          created_at: string
          id: string
          medication_state: string | null
          notes: string | null
          owner_id: string
          protocol_id: string | null
          recording_condition: string | null
          subject_id: string
          visit_date: string
        }
        Insert: {
          clinical_scores?: Json
          created_at?: string
          id?: string
          medication_state?: string | null
          notes?: string | null
          owner_id: string
          protocol_id?: string | null
          recording_condition?: string | null
          subject_id: string
          visit_date?: string
        }
        Update: {
          clinical_scores?: Json
          created_at?: string
          id?: string
          medication_state?: string | null
          notes?: string | null
          owner_id?: string
          protocol_id?: string | null
          recording_condition?: string | null
          subject_id?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
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
      research_coded_results: {
        Args: never
        Returns: {
          age: number
          completed_at: string
          feature_pipeline_version: string
          modality: string
          model_version: string
          parameters: Json
          pose_estimator_version: string
          quality: Json
          recording_condition: string
          run_id: string
          sex: string
          subject_code: string
          visit_date: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "clinician" | "researcher"
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
    Enums: {
      app_role: ["admin", "clinician", "researcher"],
    },
  },
} as const
