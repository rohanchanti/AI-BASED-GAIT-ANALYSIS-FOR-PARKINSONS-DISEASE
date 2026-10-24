ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id);
UPDATE public.recordings r SET subject_id = v.subject_id FROM public.visits v WHERE v.id = r.visit_id AND r.subject_id IS NULL;
CREATE INDEX IF NOT EXISTS recordings_subject_id_idx ON public.recordings(subject_id);
CREATE OR REPLACE FUNCTION public.tg_recording_subject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vs uuid;
BEGIN
  SELECT subject_id INTO vs FROM public.visits WHERE id = NEW.visit_id;
  IF NEW.subject_id IS NULL THEN NEW.subject_id := vs;
  ELSIF NEW.subject_id IS DISTINCT FROM vs THEN RAISE EXCEPTION 'Recording subject must match the visit subject';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_recording_subject() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER recordings_subject BEFORE INSERT OR UPDATE OF visit_id, subject_id ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.tg_recording_subject();