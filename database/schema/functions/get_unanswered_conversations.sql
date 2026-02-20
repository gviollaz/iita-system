-- Conversaciones sin responder
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_unanswered_conversations(p_limit integer DEFAULT 30)
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT c.id AS conversation_id, c.start_date,
      p.id AS person_id, p.first_name, p.last_name,
      pc.address AS person_address,
      ch.name AS channel_name, cp.name AS provider, b.name AS branch_name,
      (SELECT i.text FROM interactions i WHERE i.id_person_conversation = pc.id ORDER BY i.time_stamp DESC LIMIT 1) AS last_msg_text,
      (SELECT i.time_stamp FROM interactions i WHERE i.id_person_conversation = pc.id ORDER BY i.time_stamp DESC LIMIT 1) AS last_msg_time,
      (SELECT COUNT(*) FROM interactions i WHERE i.id_person_conversation = pc.id)::int AS msg_count
    FROM conversations c
    JOIN person_conversation pc ON pc.id_conversation = c.id
    JOIN persons p ON p.id = pc.id_person
    JOIN system_conversation sc ON sc.id_conversation = c.id
    JOIN channels ch ON ch.id = sc.id_channel
    JOIN channel_providers cp ON cp.id = ch.id_channel_provider
    LEFT JOIN branches b ON b.id = ch.branch_id
    WHERE (SELECT COUNT(*) FROM interactions i WHERE i.id_person_conversation = pc.id) > 0
      AND (SELECT COUNT(*) FROM interactions i WHERE i.id_system_conversation = sc.id) = 0
    ORDER BY last_msg_time DESC NULLS LAST LIMIT p_limit
  ) t;
$$;
