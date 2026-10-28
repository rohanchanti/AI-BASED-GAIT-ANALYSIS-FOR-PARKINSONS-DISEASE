GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity, entity_id);

CREATE OR REPLACE FUNCTION public.tg_audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, '{}'::jsonb);
    RETURN OLD;
  END IF;
  SELECT array_agg(n.key ORDER BY n.key) INTO changed
  FROM jsonb_each(to_jsonb(NEW)) n
  WHERE n.value IS DISTINCT FROM to_jsonb(OLD) -> n.key
    AND n.key NOT IN ('updated_at', 'heartbeat_at', 'progress', 'stage');
  IF changed IS NULL THEN RETURN NEW; END IF;
  -- Only column names are recorded, never values, so identifiable data is not copied into the log.
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'edit', TG_TABLE_NAME, NEW.id, jsonb_build_object('fields', to_jsonb(changed)));
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','visits','recordings','analysis_runs','reports','consents','user_roles','clinical_reports','research_projects','research_participants'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER audit_change AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_change()', t);
  END LOOP;
END $$;