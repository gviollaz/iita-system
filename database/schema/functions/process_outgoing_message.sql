-- Procesa mensaje saliente: busca conversacion y crea interaccion
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION process_outgoing_message(
  p_address text, p_channel_id integer,
  p_text text DEFAULT NULL, p_external_ref text DEFAULT NULL,
  p_status text DEFAULT 'send'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sc_id INT; v_conv_id INT; v_interaction_id INT; v_existing_id INT;
BEGIN
  IF p_external_ref IS NOT NULL AND p_external_ref != '' THEN
    SELECT id INTO v_existing_id FROM interactions WHERE external_ref = p_external_ref LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'existing_interaction_id', v_existing_id);
    END IF;
  END IF;

  SELECT sc.id, sc.id_conversation INTO v_sc_id, v_conv_id
  FROM system_conversation sc
  JOIN person_conversation pc ON pc.id_conversation = sc.id_conversation
  WHERE pc.address = p_address AND sc.id_channel = p_channel_id
  ORDER BY sc.id DESC LIMIT 1;

  IF v_sc_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No existe conversacion para address=' || p_address || ' channel=' || p_channel_id);
  END IF;

  INSERT INTO interactions (id_system_conversation, text, time_stamp, status, external_ref)
  VALUES (v_sc_id, p_text, NOW(), p_status::interaction_status, p_external_ref)
  RETURNING id INTO v_interaction_id;

  RETURN jsonb_build_object('success', TRUE, 'duplicate', FALSE,
    'conversation_id', v_conv_id, 'system_conversation_id', v_sc_id,
    'interaction_id', v_interaction_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
