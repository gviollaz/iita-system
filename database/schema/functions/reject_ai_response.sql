-- Rechaza una respuesta de IA pendiente (marca como 'confictive')
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION reject_ai_response(p_ai_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_eval text;
BEGIN
  SELECT evaluation::text INTO v_current_eval
  FROM ai_interaction
  WHERE id = p_ai_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_current_eval = 'confictive' THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true);
  END IF;

  IF v_current_eval IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending',
      'current_evaluation', v_current_eval);
  END IF;

  UPDATE ai_interaction
  SET evaluation = 'confictive'
  WHERE id = p_ai_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
