-- Lista conversaciones con filtros, paginacion y LATERAL joins optimizados
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_conversations(
  p_provider text DEFAULT NULL, p_channel_id integer DEFAULT NULL,
  p_branch_id integer DEFAULT NULL, p_status text DEFAULT NULL,
  p_search text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0, p_date_from timestamp DEFAULT NULL,
  p_date_to timestamp DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE result json; BEGIN
  -- Uses CTEs: ai_filtered_pcs, filtered_convos + LATERAL joins
  SELECT json_agg(row_to_json(t)) INTO result FROM (
    WITH ai_filtered_pcs AS (
      SELECT DISTINCT ii.id_person_conversation FROM interactions ii
      JOIN ai_interaction ai ON ai.associated_interaction_id = ii.id
      WHERE p_status IN ('ai_pending', 'ai_approved')
        AND ai.evaluation = CASE p_status WHEN 'ai_pending' THEN 'pending'::ai_interaction_evaluation
          WHEN 'ai_approved' THEN 'approved'::ai_interaction_evaluation END
        AND (p_date_from IS NULL OR ii.time_stamp >= p_date_from)
        AND (p_date_to IS NULL OR ii.time_stamp <= p_date_to)
    ),
    filtered_convos AS (
      SELECT c.id AS conversation_id, c.start_date, c.last_activity_at,
        p.id AS person_id, p.first_name, p.last_name,
        pc.id AS pc_id, pc.address AS person_address,
        sc.id AS sc_id, ch.id AS channel_id, ch.name AS channel_name,
        ch.branch_id, cp.name AS provider, b.name AS branch_name
      FROM conversations c
      JOIN person_conversation pc ON pc.id_conversation = c.id
      JOIN persons p ON p.id = pc.id_person
      JOIN system_conversation sc ON sc.id_conversation = c.id
      JOIN channels ch ON ch.id = sc.id_channel
      JOIN channel_providers cp ON cp.id = ch.id_channel_provider
      LEFT JOIN branches b ON b.id = ch.branch_id
      WHERE (p_provider IS NULL OR cp.name = p_provider)
        AND (p_channel_id IS NULL OR ch.id = p_channel_id)
        AND (p_branch_id IS NULL OR ch.branch_id = p_branch_id)
        AND (p_status NOT IN ('ai_pending','ai_approved') OR p_status IS NULL
             OR pc.id IN (SELECT id_person_conversation FROM ai_filtered_pcs))
        AND (p_status IS NULL OR p_status IN ('ai_pending','ai_approved')
          OR (p_status = 'unanswered' AND NOT EXISTS (SELECT 1 FROM interactions i2 WHERE i2.id_system_conversation = sc.id)
              AND EXISTS (SELECT 1 FROM interactions i2 WHERE i2.id_person_conversation = pc.id))
          OR (p_status = 'answered' AND EXISTS (SELECT 1 FROM interactions i2 WHERE i2.id_system_conversation = sc.id))
          OR (p_status = 'incomplete' AND EXISTS (SELECT 1 FROM interactions i2 WHERE i2.id_person_conversation = pc.id)
              AND NOT EXISTS (SELECT 1 FROM interactions i2 WHERE i2.id_system_conversation = sc.id)))
        AND (p_date_from IS NULL OR p_status IN ('ai_pending','ai_approved') OR c.start_date >= p_date_from)
        AND (p_date_to IS NULL OR p_status IN ('ai_pending','ai_approved') OR c.start_date <= p_date_to)
        AND (p_search IS NULL OR p.first_name ILIKE '%' || p_search || '%'
          OR p.last_name ILIKE '%' || p_search || '%'
          OR pc.address ILIKE '%' || p_search || '%'
          OR p.email ILIKE '%' || p_search || '%')
      ORDER BY c.last_activity_at DESC NULLS LAST
      LIMIT p_limit OFFSET p_offset
    )
    SELECT f.conversation_id, f.start_date, f.person_id, f.first_name, f.last_name,
      f.person_address, f.channel_id, f.channel_name, f.branch_id, f.provider, f.branch_name,
      lm.last_message, f.last_activity_at AS last_activity, mi.msgs_in, mo.msgs_out,
      (mo.msgs_out > 0) AS has_reply
    FROM filtered_convos f
    LEFT JOIN LATERAL (
      SELECT json_build_object('text', x.text, 'time_stamp', x.time_stamp,
        'is_incoming', x.id_person_conversation IS NOT NULL) AS last_message
      FROM interactions x
      WHERE x.id_person_conversation = f.pc_id OR x.id_system_conversation = f.sc_id
      ORDER BY x.time_stamp DESC LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS msgs_in FROM interactions x WHERE x.id_person_conversation = f.pc_id) mi ON true
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS msgs_out FROM interactions x WHERE x.id_system_conversation = f.sc_id) mo ON true
    ORDER BY f.last_activity_at DESC NULLS LAST
  ) t;
  RETURN COALESCE(result, '[]'::json);
END; $$;
