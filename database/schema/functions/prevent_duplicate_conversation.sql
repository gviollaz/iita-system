-- Trigger function: previene conversaciones duplicadas (mismo address + channel)
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- Se ejecuta BEFORE INSERT en system_conversation
CREATE OR REPLACE FUNCTION prevent_duplicate_conversation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_address TEXT; v_existing_conv_id INT;
BEGIN
  SELECT address INTO v_address FROM person_conversation WHERE id_conversation = NEW.id_conversation;
  IF v_address IS NULL THEN RETURN NEW; END IF;

  SELECT sc2.id_conversation INTO v_existing_conv_id
  FROM system_conversation sc2
  JOIN person_conversation pc2 ON pc2.id_conversation = sc2.id_conversation
  WHERE sc2.id_channel = NEW.id_channel AND pc2.address = v_address
    AND sc2.id_conversation != NEW.id_conversation LIMIT 1;

  IF v_existing_conv_id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_CONV: address=% channel=% already exists in conversation_id=%',
      v_address, NEW.id_channel, v_existing_conv_id USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;
