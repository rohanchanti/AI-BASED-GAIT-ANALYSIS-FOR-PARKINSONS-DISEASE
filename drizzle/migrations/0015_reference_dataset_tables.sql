CREATE TABLE public.reference_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  source_url text NOT NULL,
  licence text NOT NULL,
  description text,
  pipeline_version text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_datasets TO authenticated;
GRANT ALL ON public.reference_datasets TO service_role;
ALTER TABLE public.reference_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_datasets_read ON public.reference_datasets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_datasets_insert ON public.reference_datasets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_datasets_update ON public.reference_datasets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_datasets_delete ON public.reference_datasets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.reference_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.reference_datasets(id),
  file_name text NOT NULL,
  size_bytes bigint,
  sha256 text,
  matches_official_checksum boolean
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_files TO authenticated;
GRANT ALL ON public.reference_files TO service_role;
ALTER TABLE public.reference_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_files_read ON public.reference_files
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_files_insert ON public.reference_files
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_files_update ON public.reference_files
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_files_delete ON public.reference_files
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.reference_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.reference_datasets(id),
  participant_id text NOT NULL,
  study text,
  group_name text,
  subject_no integer,
  sex text,
  age numeric,
  height_m numeric,
  weight_kg numeric,
  hoehn_yahr numeric,
  updrs numeric,
  updrs_motor numeric,
  tug_s numeric,
  speed_01 numeric,
  speed_02 numeric,
  speed_03 numeric,
  speed_04 numeric,
  speed_05 numeric,
  speed_06 numeric,
  speed_07 numeric,
  speed_10 numeric
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_subjects TO authenticated;
GRANT ALL ON public.reference_subjects TO service_role;
ALTER TABLE public.reference_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_subjects_read ON public.reference_subjects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_subjects_insert ON public.reference_subjects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_subjects_update ON public.reference_subjects
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_subjects_delete ON public.reference_subjects
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.reference_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.reference_datasets(id),
  file_name text NOT NULL,
  participant_id text NOT NULL,
  study text,
  group_name text,
  subject_no integer,
  walk_no integer,
  task text,
  duration_s numeric,
  n_strides_left integer,
  n_excluded_left integer,
  stride_time_left_mean_s numeric,
  stride_time_left_sd_s numeric,
  stride_time_left_cv_pct numeric,
  n_strides_right integer,
  n_excluded_right integer,
  stride_time_right_mean_s numeric,
  stride_time_right_sd_s numeric,
  stride_time_right_cv_pct numeric,
  status text NOT NULL
    CHECK (status IN ('estimated', 'unreliable', 'failed')),
  note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_features TO authenticated;
GRANT ALL ON public.reference_features TO service_role;
ALTER TABLE public.reference_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_features_read ON public.reference_features
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_features_insert ON public.reference_features
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_features_update ON public.reference_features
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY reference_features_delete ON public.reference_features
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));