-- Procesa mensaje entrante: busca/crea persona, conversacion e interaccion
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- Version con soporte para username (p_username)
CREATE OR REPLACE FUNCTION process_incoming_message(
  p_address text,
  p_channel_id integer,
  p_text text DEFAULT NULL,
  p_external_ref text DEFAULT NULL,
  p_person_name text DEFAULT NULL,
  p_ad_external_ref text DEFAULT NULL,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_person_id INT;
  v_conv_id INT;
  v_pc_id INT;
  v_sc_id INT;
  v_interaction_id INT;
  v_ad_id INT;
  v_was_new_person BOOLEAN := FALSE;
  v_was_new_conv BOOLEAN := FALSE;
  v_provider_id INT;
  v_existing_interaction_id INT;
BEGIN
  -- Verificar duplicado por external_ref
  IF p_external_ref IS NOT NULL AND p_external_ref != '' THEN
    SELECT id INTO v_existing_interaction_id
    FROM interactions WHERE external_ref = p_external_ref LIMIT 1;
    IF v_existing_interaction_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE,
        'existing_interaction_id', v_existing_interaction_id,
        'message', 'Mensaje ya registrado previamente');
    END IF;
  END IF;

  SELECT id_channel_provider INTO v_provider_id FROM channels WHERE id = p_channel_id;
  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Canal no encontrado: ' || p_channel_id);
  END IF;

  -- Buscar persona por address
  SELECT DISTINCT pc.id_person INTO v_person_id
  FROM person_conversation pc WHERE pc.address = p_address
  ORDER BY pc.id_person ASC LIMIT 1;

  IF v_person_id IS NULL THEN
    SELECT pcon.person_id INTO v_person_id
    FROM person_contacts pcon
    WHERE pcon.contact_value = p_address AND pcon.channel_provider_id = v_provider_id
    ORDER BY pcon.person_id ASC LIMIT 1;
  END IF;

  IF v_person_id IS NULL THEN
    INSERT INTO persons (first_name, creation_datetime)
    VALUES (p_person_name, NOW()) RETURNING id INTO v_person_id;
    INSERT INTO person_contacts (person_id, channel_provider_id, contact_value)
    VALUES (v_person_id, v_provider_id, p_address) ON CONFLICT DO NOTHING;
    v_was_new_person := TRUE;
  ELSE
    IF p_person_name IS NOT NULL THEN
      UPDATE persons SET first_name = p_person_name
      WHERE id = v_person_id AND (first_name IS NULL OR first_name = '');
    END IF;
  END IF;

  -- Buscar conversacion existente
  SELECT pc.id_conversation, pc.id, sc.id
  INTO v_conv_id, v_pc_id, v_sc_id
  FROM person_conversation pc
  JOIN system_conversation sc ON sc.id_conversation = pc.id_conversation
  WHERE pc.address = p_address AND sc.id_channel = p_channel_id
  ORDER BY pc.id DESC LIMIT 1 FOR UPDATE OF pc, sc;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (start_date) VALUES (NOW()) RETURNING id INTO v_conv_id;
    INSERT INTO person_conversation (id_person, id_conversation, address, contact_username)
      VALUES (v_person_id, v_conv_id, p_address, p_username) RETURNING id INTO v_pc_id;
    INSERT INTO system_conversation (id_channel, id_conversation)
      VALUES (p_channel_id, v_conv_id) RETURNING id INTO v_sc_id;
    v_was_new_conv := TRUE;
  ELSE
    IF p_username IS NOT NULL AND p_username != '' THEN
      UPDATE person_conversation SET contact_username = p_username
      WHERE id = v_pc_id AND (contact_username IS NULL OR contact_username = '');
    END IF;
  END IF;

  IF p_ad_external_ref IS NOT NULL AND p_ad_external_ref != '' THEN
    SELECT id INTO v_ad_id FROM ads WHERE external_ref = p_ad_external_ref LIMIT 1;
  END IF;

  INSERT INTO interactions (id_person_conversation, text, time_stamp, status, external_ref, ad_id)
  VALUES (v_pc_id, p_text, NOW(), 'new', p_external_ref, v_ad_id)
  RETURNING id INTO v_interaction_id;

  RETURN jsonb_build_object(
    'success', TRUE, 'duplicate', FALSE,
    'person_id', v_person_id, 'conversation_id', v_conv_id,
    'person_conversation_id', v_pc_id, 'system_conversation_id', v_sc_id,
    'interaction_id', v_interaction_id, 'ad_id', v_ad_id,
    'new_person', v_was_new_person, 'new_conversation', v_was_new_conv
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
