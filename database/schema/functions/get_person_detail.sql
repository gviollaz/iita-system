-- Detalle de persona con conversaciones y fuentes de ads
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_person_detail(p_person_id integer)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE result json; BEGIN
  SELECT json_build_object(
    'person', (SELECT row_to_json(p) FROM persons p WHERE p.id = p_person_id),
    'conversations', (SELECT COALESCE(json_agg(row_to_json(t2)), '[]'::json) FROM (
      SELECT c.id AS conversation_id, c.start_date, pc.address,
        ch.name AS channel_name, cp.name AS provider, b.name AS branch_name,
        (SELECT COUNT(*) FROM interactions i WHERE i.id_person_conversation = pc.id)::int AS msgs_in,
        (SELECT COUNT(*) FROM interactions i WHERE i.id_system_conversation = sc.id)::int AS msgs_out,
        (SELECT MAX(i.time_stamp) FROM interactions i WHERE i.id_person_conversation = pc.id OR i.id_system_conversation = sc.id) AS last_activity,
        (SELECT i.text FROM interactions i WHERE i.id_person_conversation = pc.id ORDER BY i.time_stamp DESC LIMIT 1) AS last_msg
      FROM person_conversation pc
      JOIN conversations c ON c.id = pc.id_conversation
      JOIN system_conversation sc ON sc.id_conversation = c.id
      JOIN channels ch ON ch.id = sc.id_channel
      JOIN channel_providers cp ON cp.id = ch.id_channel_provider
      LEFT JOIN branches b ON b.id = ch.branch_id
      WHERE pc.id_person = p_person_id
      ORDER BY last_activity DESC NULLS LAST) t2),
    'ads_sources', (SELECT COALESCE(json_agg(row_to_json(t3)), '[]'::json) FROM (
      SELECT DISTINCT ON (a.id) a.id, a.title, ap.name AS ad_provider, co.name AS course_name
      FROM interactions i
      JOIN person_conversation pc ON pc.id = i.id_person_conversation
      JOIN ads a ON a.id = i.ad_id
      LEFT JOIN ad_providers ap ON ap.id = a.ad_provider_id
      LEFT JOIN courses co ON co.id = a.course_id
      WHERE pc.id_person = p_person_id AND i.ad_id IS NOT NULL
      ORDER BY a.id) t3),
    'total_messages', (SELECT COUNT(*) FROM interactions i
      JOIN person_conversation pc ON pc.id = i.id_person_conversation WHERE pc.id_person = p_person_id),
    'first_contact', (SELECT MIN(i.time_stamp) FROM interactions i
      JOIN person_conversation pc ON pc.id = i.id_person_conversation WHERE pc.id_person = p_person_id),
    'last_contact', (SELECT MAX(i.time_stamp) FROM interactions i
      JOIN person_conversation pc ON pc.id = i.id_person_conversation WHERE pc.id_person = p_person_id)
  ) INTO result;
  RETURN result;
END; $$;
