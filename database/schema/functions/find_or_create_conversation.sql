-- Busca o crea una conversacion por address + channel
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION find_or_create_conversation(
  p_address text, p_channel_id integer, p_person_id integer
)
RETURNS TABLE(conversation_id integer, person_conversation_id integer, system_conversation_id integer, was_created boolean)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_conv_id INT; v_pc_id INT; v_sc_id INT; v_created BOOLEAN := FALSE;
BEGIN
  SELECT sc.id_conversation, pc.id, sc.id
  INTO v_conv_id, v_pc_id, v_sc_id
  FROM person_conversation pc
  JOIN system_conversation sc ON sc.id_conversation = pc.id_conversation
  WHERE pc.address = p_address AND sc.id_channel = p_channel_id
  ORDER BY pc.id DESC LIMIT 1 FOR UPDATE OF pc, sc;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (start_date) VALUES (NOW()) RETURNING id INTO v_conv_id;
    INSERT INTO person_conversation (id_person, id_conversation, address)
      VALUES (p_person_id, v_conv_id, p_address) RETURNING id INTO v_pc_id;
    INSERT INTO system_conversation (id_channel, id_conversation)
      VALUES (p_channel_id, v_conv_id) RETURNING id INTO v_sc_id;
    v_created := TRUE;
  END IF;

  RETURN QUERY SELECT v_conv_id, v_pc_id, v_sc_id, v_created;
END;
$$;
