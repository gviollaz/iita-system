-- Trigger function: previene interacciones eco y duplicados por external_ref
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-19
-- Se ejecuta BEFORE INSERT en interactions
CREATE OR REPLACE FUNCTION prevent_echo_interaction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  -- Guard 1: Duplicate external_ref
  IF NEW.external_ref IS NOT NULL AND LENGTH(NEW.external_ref) > 10 THEN
    IF EXISTS (SELECT 1 FROM interactions WHERE external_ref = NEW.external_ref LIMIT 1) THEN
      RAISE LOG 'Duplicate external_ref blocked: %', LEFT(NEW.external_ref, 50);
      RETURN NULL;
    END IF;
  END IF;

  -- Guard 2: Echo prevention (same text within 60s on same system_conversation)
  IF NEW.id_system_conversation IS NOT NULL AND NEW.text IS NOT NULL AND NEW.text != ''
     AND NEW.status = 'preprocessed' THEN
    IF EXISTS (SELECT 1 FROM interactions
      WHERE id_system_conversation = NEW.id_system_conversation
        AND status = 'send' AND text = NEW.text
        AND time_stamp > NEW.time_stamp - interval '60 seconds'
        AND time_stamp <= NEW.time_stamp LIMIT 1) THEN
      RAISE LOG 'Echo interaction blocked: system_conversation=%, text preview=%',
        NEW.id_system_conversation, LEFT(NEW.text, 50);
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
