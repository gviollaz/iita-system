-- Top leads mas activos
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_top_leads(p_limit integer DEFAULT 20)
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT p.id, p.first_name, p.last_name, p.creation_datetime,
      COUNT(DISTINCT pc.id_conversation) AS total_conversations,
      COUNT(i.id) AS total_messages,
      MAX(i.time_stamp) AS last_activity,
      (SELECT cp2.name FROM person_conversation pc2
        JOIN system_conversation sc2 ON sc2.id_conversation = pc2.id_conversation
        JOIN channels ch2 ON ch2.id = sc2.id_channel
        JOIN channel_providers cp2 ON cp2.id = ch2.id_channel_provider
        WHERE pc2.id_person = p.id ORDER BY pc2.id DESC LIMIT 1) AS last_provider
    FROM persons p
    JOIN person_conversation pc ON pc.id_person = p.id
    LEFT JOIN interactions i ON i.id_person_conversation = pc.id
    GROUP BY p.id HAVING COUNT(i.id) > 0
    ORDER BY last_activity DESC NULLS LAST LIMIT p_limit
  ) t;
$$;
