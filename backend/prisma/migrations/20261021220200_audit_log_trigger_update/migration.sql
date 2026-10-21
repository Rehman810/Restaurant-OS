CREATE OR REPLACE FUNCTION audit_log_deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog is append-only';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Allow branch FK ON DELETE SET NULL (branchId only may change)
    IF (to_jsonb(OLD) - 'branchId') = (to_jsonb(NEW) - 'branchId') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'AuditLog is append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
