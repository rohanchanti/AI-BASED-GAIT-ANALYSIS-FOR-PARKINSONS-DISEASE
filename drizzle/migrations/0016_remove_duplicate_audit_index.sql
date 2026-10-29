-- Both indexes are identical non-unique btree indexes on (entity, entity_id).
-- Keep audit_log_entity_entity_id_idx; no rows, constraints, or policies change.
DROP INDEX IF EXISTS public.audit_log_entity_idx;