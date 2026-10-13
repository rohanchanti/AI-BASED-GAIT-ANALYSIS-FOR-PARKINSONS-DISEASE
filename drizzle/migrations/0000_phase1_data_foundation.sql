CREATE TYPE public.app_role AS ENUM ('admin','clinician','researcher');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- protocols
CREATE TABLE public.protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  test_type text NOT NULL DEFAULT 'walk',
  workflow text NOT NULL DEFAULT 'clinical' CHECK (workflow IN ('clinical','research')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- subjects
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subject_code text NOT NULL CHECK (char_length(subject_code) BETWEEN 1 AND 64),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 120),
  workflow text NOT NULL DEFAULT 'clinical' CHECK (workflow IN ('clinical','research')),
  age integer CHECK (age IS NULL OR age BETWEEN 0 AND 150),
  sex text CHECK (sex IS NULL OR char_length(sex) <= 32),
  height_cm numeric CHECK (height_cm IS NULL OR height_cm BETWEEN 30 AND 260),
  weight_kg numeric CHECK (weight_kg IS NULL OR weight_kg BETWEEN 1 AND 400),
  retention_status text NOT NULL DEFAULT 'active' CHECK (retention_status IN ('active','retention_hold','scheduled_deletion','anonymised')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, subject_code)
);

CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('clinical_care','research_use','media_storage','data_sharing')),
  granted boolean NOT NULL,
  document_version text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  notes text
);

CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  protocol_id uuid REFERENCES public.protocols(id) ON DELETE SET NULL,
  visit_date timestamptz NOT NULL DEFAULT now(),
  recording_condition text,
  medication_state text,
  clinical_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('upload','live','import')),
  modality text NOT NULL DEFAULT 'gait' CHECK (modality IN ('gait','facial','voice')),
  original_filename text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  duration_sec numeric,
  fps numeric,
  width integer,
  height integer,
  camera_view text,
  walking_distance_m numeric,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','complete','failed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  analysis_code text,
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('running','complete','failed')),
  analysis_mode text,
  platform_version text,
  model_version text,
  feature_pipeline_version text,
  pose_estimator_version text,
  preprocessing_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.gait_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL UNIQUE REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  pose_metrics jsonb,
  quality jsonb,
  validation jsonb,
  events jsonb,
  landmark_summary jsonb,
  model_score numeric,
  model_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinician_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL DEFAULT 'noted' CHECK (decision IN ('noted','accepted','needs_repeat','rejected')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  run_id uuid REFERENCES public.analysis_runs(id) ON DELETE SET NULL,
  format text NOT NULL CHECK (format IN ('pdf','png','csv','json')),
  deidentified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ADD COLUMN analysis_run_id uuid REFERENCES public.analysis_runs(id) ON DELETE SET NULL;

-- indexes
CREATE INDEX ON public.subjects(owner_id);
CREATE INDEX ON public.consents(subject_id);
CREATE INDEX ON public.visits(subject_id, visit_date DESC);
CREATE INDEX ON public.recordings(visit_id);
CREATE INDEX ON public.analysis_runs(recording_id, started_at DESC);
CREATE INDEX ON public.clinician_reviews(run_id);
CREATE INDEX ON public.audit_log(entity, entity_id);
CREATE INDEX ON public.export_log(user_id);

-- grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocols, public.subjects, public.consents, public.visits, public.recordings, public.analysis_runs, public.gait_results, public.clinician_reviews TO authenticated;
GRANT SELECT, INSERT ON public.audit_log, public.export_log TO authenticated;
GRANT ALL ON public.protocols, public.subjects, public.consents, public.visits, public.recordings, public.analysis_runs, public.gait_results, public.clinician_reviews, public.audit_log, public.export_log TO service_role;

-- RLS
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['protocols','subjects','consents','visits','recordings','analysis_runs','gait_results'] LOOP
    EXECUTE format('CREATE POLICY "Owner manages %1$s" ON public.%1$I FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)', t);
    EXECUTE format('CREATE POLICY "Admins read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''))', t);
  END LOOP;
END $$;

-- parent ownership checks
CREATE POLICY "Consent subject owned" ON public.consents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND s.owner_id = auth.uid()));
CREATE POLICY "Visit subject owned" ON public.visits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND s.owner_id = auth.uid()));
CREATE POLICY "Recording visit owned" ON public.recordings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.owner_id = auth.uid()));
CREATE POLICY "Run recording owned" ON public.analysis_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.recordings r WHERE r.id = recording_id AND r.owner_id = auth.uid()));
CREATE POLICY "Result run owned" ON public.gait_results AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid()));

-- reviews: clinicians/admins on runs they own (or admin any)
CREATE POLICY "Reviewers read reviews" ON public.clinician_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid()));
CREATE POLICY "Clinicians write reviews" ON public.clinician_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid()
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin'))
    AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid())));
CREATE POLICY "Reviewers edit own reviews" ON public.clinician_reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid());

-- logs: insert-only as self
CREATE POLICY "Insert own audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE POLICY "Admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Insert own export" ON public.export_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Read own export" ON public.export_log FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at
CREATE TRIGGER protocols_updated BEFORE UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER subjects_updated BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- de-identified research access (coded IDs only, consented to research)
CREATE OR REPLACE FUNCTION public.research_coded_results()
RETURNS TABLE (subject_code text, age integer, sex text, visit_date timestamptz, recording_condition text,
  modality text, run_id uuid, model_version text, feature_pipeline_version text, pose_estimator_version text,
  parameters jsonb, quality jsonb, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'researcher') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT s.subject_code, s.age, s.sex, v.visit_date, v.recording_condition, r.modality, a.id,
         a.model_version, a.feature_pipeline_version, a.pose_estimator_version, g.parameters, g.quality, a.completed_at
  FROM public.analysis_runs a
  JOIN public.recordings r ON r.id = a.recording_id
  JOIN public.visits v ON v.id = r.visit_id
  JOIN public.subjects s ON s.id = v.subject_id
  LEFT JOIN public.gait_results g ON g.run_id = a.id
  WHERE s.retention_status = 'active'
    AND EXISTS (SELECT 1 FROM public.consents c WHERE c.subject_id = s.id AND c.consent_type = 'research_use' AND c.granted AND c.withdrawn_at IS NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.research_coded_results() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.research_coded_results() TO authenticated;

-- storage rules for future private bucket
CREATE POLICY "Own recordings read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own recordings write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own recordings delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);