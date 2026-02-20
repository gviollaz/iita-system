-- Trigger function: actualiza last_activity_at en conversations al insertar interaccion
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- Se ejecuta AFTER INSERT en interactions
CREATE OR REPLACE FUNCTION update_conversation_last_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE conv_id integer;
BEGIN
  IF NEW.id_person_conversation IS NOT NULL THEN
    SELECT id_conversation INTO conv_id FROM person_conversation WHERE id = NEW.id_person_conversation;
  ELSIF NEW.id_system_conversation IS NOT NULL THEN
    SELECT id_conversation INTO conv_id FROM system_conversation WHERE id = NEW.id_system_conversation;
  END IF;

  IF conv_id IS NOT NULL THEN
    UPDATE conversations SET last_activity_at = NEW.time_stamp
    WHERE id = conv_id AND (last_activity_at IS NULL OR last_activity_at < NEW.time_stamp);
  END IF;
  RETURN NEW;
END;
$$;
