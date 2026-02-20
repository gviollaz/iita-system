-- Busqueda de personas con texto libre
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION search_persons(
  p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT p.id, p.first_name, p.last_name, p.email, p.creation_datetime,
      COUNT(DISTINCT pc.id_conversation) AS total_conversations,
      (SELECT MAX(i.time_stamp) FROM interactions i JOIN person_conversation pc2 ON pc2.id = i.id_person_conversation WHERE pc2.id_person = p.id) AS last_activity,
      (SELECT cp2.name FROM person_conversation pc2
        JOIN system_conversation sc2 ON sc2.id_conversation = pc2.id_conversation
        JOIN channels ch2 ON ch2.id = sc2.id_channel
        JOIN channel_providers cp2 ON cp2.id = ch2.id_channel_provider
        WHERE pc2.id_person = p.id ORDER BY pc2.id DESC LIMIT 1) AS last_provider,
      (SELECT pc2.address FROM person_conversation pc2 WHERE pc2.id_person = p.id ORDER BY pc2.id DESC LIMIT 1) AS last_address
    FROM persons p
    LEFT JOIN person_conversation pc ON pc.id_person = p.id
    WHERE p_search IS NULL OR p.first_name ILIKE '%' || p_search || '%'
      OR p.last_name ILIKE '%' || p_search || '%'
      OR EXISTS (SELECT 1 FROM person_conversation pc3 WHERE pc3.id_person = p.id AND pc3.address ILIKE '%' || p_search || '%')
    GROUP BY p.id ORDER BY last_activity DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
$$;
