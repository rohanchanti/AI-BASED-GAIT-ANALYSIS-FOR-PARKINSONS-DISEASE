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
          model_name: string | null
          model_version: string | null
          owner_id: string
          parameters: Json | null
          pipeline_version: string | null
          platform_version: string | null
          pose_estimator_version: string | null
          preprocessing_config: Json
          progress: number
          quality_metrics: Json | null
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
          model_name?: string | null
          model_version?: string | null
          owner_id: string
          parameters?: Json | null
          pipeline_version?: string | null
          platform_version?: string | null
          pose_estimator_version?: string | null
          preprocessing_config?: Json
          progress?: number
          quality_metrics?: Json | null
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
          model_name?: string | null
          model_version?: string | null
          owner_id?: string
          parameters?: Json | null
          pipeline_version?: string | null
          platform_version?: string | null
          pose_estimator_version?: string | null
          preprocessing_config?: Json
          progress?: number
          quality_metrics?: Json | null
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
      clinical_reports: {
        Row: {
          content: Json
          created_at: string
          id: string
          owner_id: string
          run_id: string
          visit_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          owner_id: string
          run_id: string
          visit_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string
          run_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_reports_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_interpretations: {
        Row: {
          author_id: string
          comments: string | null
          created_at: string
          id: string
          interpretation: string
          run_id: string
          supersedes: string | null
        }
        Insert: {
          author_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          interpretation: string
          run_id: string
          supersedes?: string | null
        }
        Update: {
          author_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          interpretation?: string
          run_id?: string
          supersedes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinician_interpretations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinician_interpretations_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "clinician_interpretations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          reviewer_id: string
          run_id: string
          supersedes: string | null
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          reviewer_id: string
          run_id: string
          supersedes?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          reviewer_id?: string
          run_id?: string
          supersedes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinician_reviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinician_reviews_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "clinician_reviews"
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
      gait_features: {
        Row: {
          analysis_run_id: string
          id: string
          method: string
          name: string
          status: string
          unit: string
          value: number | null
        }
        Insert: {
          analysis_run_id: string
          id?: string
          method: string
          name: string
          status: string
          unit: string
          value?: number | null
        }
        Update: {
          analysis_run_id?: string
          id?: string
          method?: string
          name?: string
          status?: string
          unit?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gait_features_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
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
      protocol_timings: {
        Row: {
          created_at: string
          distance_m: number | null
          end_sec: number
          id: string
          method: string
          notes: string | null
          owner_id: string
          protocol: string
          run_id: string
          start_sec: number
          verified_by: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          end_sec: number
          id?: string
          method: string
          notes?: string | null
          owner_id: string
          protocol: string
          run_id: string
          start_sec: number
          verified_by: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          end_sec?: number
          id?: string
          method?: string
          notes?: string | null
          owner_id?: string
          protocol?: string
          run_id?: string
          start_sec?: number
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_timings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
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
          subject_id: string | null
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
          subject_id?: string | null
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
          subject_id?: string | null
          trial_number?: number | null
          visit_id?: string
          walking_distance_m?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_datasets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          licence: string
          name: string
          parameters: Json
          pipeline_version: string
          source_url: string
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          licence: string
          name: string
          parameters?: Json
          pipeline_version: string
          source_url: string
          version: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          licence?: string
          name?: string
          parameters?: Json
          pipeline_version?: string
          source_url?: string
          version?: string
        }
        Relationships: []
      }
      reference_features: {
        Row: {
          dataset_id: string
          duration_s: number | null
          file_name: string
          group_name: string | null
          id: string
          n_excluded_left: number | null
          n_excluded_right: number | null
          n_strides_left: number | null
          n_strides_right: number | null
          note: string | null
          participant_id: string
          status: string
          stride_time_left_cv_pct: number | null
          stride_time_left_mean_s: number | null
          stride_time_left_sd_s: number | null
          stride_time_right_cv_pct: number | null
          stride_time_right_mean_s: number | null
          stride_time_right_sd_s: number | null
          study: string | null
          subject_no: number | null
          task: string | null
          walk_no: number | null
        }
        Insert: {
          dataset_id: string
          duration_s?: number | null
          file_name: string
          group_name?: string | null
          id?: string
          n_excluded_left?: number | null
          n_excluded_right?: number | null
          n_strides_left?: number | null
          n_strides_right?: number | null
          note?: string | null
          participant_id: string
          status: string
          stride_time_left_cv_pct?: number | null
          stride_time_left_mean_s?: number | null
          stride_time_left_sd_s?: number | null
          stride_time_right_cv_pct?: number | null
          stride_time_right_mean_s?: number | null
          stride_time_right_sd_s?: number | null
          study?: string | null
          subject_no?: number | null
          task?: string | null
          walk_no?: number | null
        }
        Update: {
          dataset_id?: string
          duration_s?: number | null
          file_name?: string
          group_name?: string | null
          id?: string
          n_excluded_left?: number | null
          n_excluded_right?: number | null
          n_strides_left?: number | null
          n_strides_right?: number | null
          note?: string | null
          participant_id?: string
          status?: string
          stride_time_left_cv_pct?: number | null
          stride_time_left_mean_s?: number | null
          stride_time_left_sd_s?: number | null
          stride_time_right_cv_pct?: number | null
          stride_time_right_mean_s?: number | null
          stride_time_right_sd_s?: number | null
          study?: string | null
          subject_no?: number | null
          task?: string | null
          walk_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_features_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "reference_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_files: {
        Row: {
          dataset_id: string
          file_name: string
          id: string
          matches_official_checksum: boolean | null
          sha256: string | null
          size_bytes: number | null
        }
        Insert: {
          dataset_id: string
          file_name: string
          id?: string
          matches_official_checksum?: boolean | null
          sha256?: string | null
          size_bytes?: number | null
        }
        Update: {
          dataset_id?: string
          file_name?: string
          id?: string
          matches_official_checksum?: boolean | null
          sha256?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_files_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "reference_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_subjects: {
        Row: {
          age: number | null
          dataset_id: string
          group_name: string | null
          height_m: number | null
          hoehn_yahr: number | null
          id: string
          participant_id: string
          sex: string | null
          speed_01: number | null
          speed_02: number | null
          speed_03: number | null
          speed_04: number | null
          speed_05: number | null
          speed_06: number | null
          speed_07: number | null
          speed_10: number | null
          study: string | null
          subject_no: number | null
          tug_s: number | null
          updrs: number | null
          updrs_motor: number | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          dataset_id: string
          group_name?: string | null
          height_m?: number | null
          hoehn_yahr?: number | null
          id?: string
          participant_id: string
          sex?: string | null
          speed_01?: number | null
          speed_02?: number | null
          speed_03?: number | null
          speed_04?: number | null
          speed_05?: number | null
          speed_06?: number | null
          speed_07?: number | null
          speed_10?: number | null
          study?: string | null
          subject_no?: number | null
          tug_s?: number | null
          updrs?: number | null
          updrs_motor?: number | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          dataset_id?: string
          group_name?: string | null
          height_m?: number | null
          hoehn_yahr?: number | null
          id?: string
          participant_id?: string
          sex?: string | null
          speed_01?: number | null
          speed_02?: number | null
          speed_03?: number | null
          speed_04?: number | null
          speed_05?: number | null
          speed_06?: number | null
          speed_07?: number | null
          speed_10?: number | null
          study?: string | null
          subject_no?: number | null
          tug_s?: number | null
          updrs?: number | null
          updrs_motor?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_subjects_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "reference_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          age: number | null
          analysis_run_id: string | null
          confidence: number | null
          created_at: string
          gender: string | null
          id: string
          kind: string
          media_url: string | null
          mode: string
          parameters: Json
          patient_name: string | null
          probability: number | null
          risk_level: string
          user_id: string
        }
        Insert: {
          age?: number | null
          analysis_run_id?: string | null
          confidence?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          kind: string
          media_url?: string | null
          mode: string
          parameters?: Json
          patient_name?: string | null
          probability?: number | null
          risk_level: string
          user_id: string
        }
        Update: {
          age?: number | null
          analysis_run_id?: string | null
          confidence?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          mode?: string
          parameters?: Json
          patient_name?: string | null
          probability?: number | null
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
      research_annotations: {
        Row: {
          created_at: string
          id: string
          method: string
          owner_id: string
          parameter_key: string
          participant_id: string
          project_id: string
          run_id: string | null
          unit: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          method: string
          owner_id: string
          parameter_key: string
          participant_id: string
          project_id: string
          run_id?: string | null
          unit: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          method?: string
          owner_id?: string
          parameter_key?: string
          participant_id?: string
          project_id?: string
          run_id?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_annotations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "research_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_annotations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_datasets: {
        Row: {
          checksum: string
          columns: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          project_id: string
          row_count: number
          rows: Json
          source: string
          validation: Json
          version: string
        }
        Insert: {
          checksum: string
          columns?: Json
          created_at?: string
          id?: string
          name: string
          owner_id: string
          project_id: string
          row_count?: number
          rows?: Json
          source: string
          validation?: Json
          version: string
        }
        Update: {
          checksum?: string
          columns?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          row_count?: number
          rows?: Json
          source?: string
          validation?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_experiments: {
        Row: {
          created_at: string
          features: Json
          id: string
          name: string
          notes: string | null
          owner_id: string
          preprocessing: Json
          project_id: string
          results: Json | null
          status: string
          updated_at: string
          versions: Json
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          preprocessing?: Json
          project_id: string
          results?: Json | null
          status?: string
          updated_at?: string
          versions?: Json
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          preprocessing?: Json
          project_id?: string
          results?: Json | null
          status?: string
          updated_at?: string
          versions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "research_experiments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_participants: {
        Row: {
          created_at: string
          exclusion_reason: string | null
          id: string
          included: boolean
          metadata: Json
          owner_id: string
          participant_code: string
          project_id: string
          split: string | null
          subject_id: string | null
        }
        Insert: {
          created_at?: string
          exclusion_reason?: string | null
          id?: string
          included?: boolean
          metadata?: Json
          owner_id: string
          participant_code: string
          project_id: string
          split?: string | null
          subject_id?: string | null
        }
        Update: {
          created_at?: string
          exclusion_reason?: string | null
          id?: string
          included?: boolean
          metadata?: Json
          owner_id?: string
          participant_code?: string
          project_id?: string
          split?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_participants_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          created_at: string
          description: string | null
          exclusion_criteria: string | null
          id: string
          inclusion_criteria: string | null
          owner_id: string
          project_code: string
          protocol: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exclusion_criteria?: string | null
          id?: string
          inclusion_criteria?: string | null
          owner_id: string
          project_code: string
          protocol?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exclusion_criteria?: string | null
          id?: string
          inclusion_criteria?: string | null
          owner_id?: string
          project_code?: string
          protocol?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          age: number | null
          clinical_history: string | null
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
          clinical_history?: string | null
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
          clinical_history?: string | null
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
          consent_id: string | null
          created_at: string
          id: string
          is_baseline: boolean
          medication_state: string | null
          notes: string | null
          owner_id: string
          protocol: string | null
          protocol_id: string | null
          recording_condition: string | null
          status: string
          subject_id: string
          visit_code: string | null
          visit_date: string
        }
        Insert: {
          clinical_scores?: Json
          consent_id?: string | null
          created_at?: string
          id?: string
          is_baseline?: boolean
          medication_state?: string | null
          notes?: string | null
          owner_id: string
          protocol?: string | null
          protocol_id?: string | null
          recording_condition?: string | null
          status?: string
          subject_id: string
          visit_code?: string | null
          visit_date?: string
        }
        Update: {
          clinical_scores?: Json
          consent_id?: string | null
          created_at?: string
          id?: string
          is_baseline?: boolean
          medication_state?: string | null
          notes?: string | null
          owner_id?: string
          protocol?: string | null
          protocol_id?: string | null
          recording_condition?: string | null
          status?: string
          subject_id?: string
          visit_code?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
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
