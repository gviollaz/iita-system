-- Aprueba una respuesta de IA pendiente y crea la interaccion saliente
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- Idempotente: si ya fue aprobada, retorna ok con already_done=true
CREATE OR REPLACE FUNCTION approve_ai_response(p_ai_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ai           record;
  v_sc_id        integer;
  v_new_int_id   integer;
  v_deadline_ok  boolean;
  v_int_ts       timestamptz;
  v_use_status   interaction_status;
  v_existing_approved_id integer;
BEGIN
  SELECT ai.id, ai.evaluation, ai.response, ai.associated_interaction_id,
         ai.generated_interaction_id
    INTO v_ai
    FROM ai_interaction ai
   WHERE ai.id = p_ai_id
     FOR UPDATE OF ai;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_ai.evaluation = 'approved' AND v_ai.generated_interaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true,
           'generated_interaction_id', v_ai.generated_interaction_id);
  END IF;

  IF v_ai.evaluation <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending',
           'current_evaluation', v_ai.evaluation);
  END IF;

  SELECT id INTO v_existing_approved_id
    FROM ai_interaction
   WHERE associated_interaction_id = v_ai.associated_interaction_id
     AND evaluation = 'approved'
     AND generated_interaction_id IS NOT NULL
     AND id != p_ai_id
   LIMIT 1;

  IF v_existing_approved_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_approved_other',
           'existing_ai_id', v_existing_approved_id,
           'message', 'Otra respuesta para este mensaje ya fue aprobada');
  END IF;

  IF v_ai.response IS NULL OR trim(v_ai.response) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_response');
  END IF;

  SELECT i.time_stamp INTO v_int_ts
    FROM interactions i
   WHERE i.id = v_ai.associated_interaction_id;

  v_deadline_ok := (v_int_ts IS NULL) OR (now() - v_int_ts < interval '24 hours');

  IF v_deadline_ok THEN
    v_use_status := 'pending_delivery'::interaction_status;
  ELSE
    v_use_status := 'preprocessed'::interaction_status;
  END IF;

  SELECT sc.id INTO v_sc_id
    FROM interactions i
    JOIN person_conversation pc ON pc.id = i.id_person_conversation
    JOIN system_conversation sc ON sc.id_conversation = pc.id_conversation
   WHERE i.id = v_ai.associated_interaction_id;

  IF v_sc_id IS NULL THEN
    SELECT i.id_system_conversation INTO v_sc_id
      FROM interactions i
     WHERE i.id = v_ai.associated_interaction_id
       AND i.id_system_conversation IS NOT NULL;
  END IF;

  IF v_sc_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_system_conversation');
  END IF;

  INSERT INTO interactions (id_system_conversation, text, time_stamp, status)
  VALUES (v_sc_id, v_ai.response, now(), v_use_status)
  RETURNING id INTO v_new_int_id;

  UPDATE ai_interaction
     SET evaluation = 'approved',
         generated_interaction_id = v_new_int_id
   WHERE id = p_ai_id;

  RETURN jsonb_build_object(
    'ok', true,
    'generated_interaction_id', v_new_int_id,
    'deadline_ok', v_deadline_ok
  );
END;
$$;
