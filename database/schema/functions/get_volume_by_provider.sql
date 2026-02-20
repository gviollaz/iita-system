-- Volumen por proveedor
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_volume_by_provider()
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT cp.name AS provider,
      COUNT(DISTINCT c.id) AS conversations, COUNT(i.id) AS messages
    FROM conversations c
    JOIN system_conversation sc ON sc.id_conversation = c.id
    JOIN channels ch ON ch.id = sc.id_channel
    JOIN channel_providers cp ON cp.id = ch.id_channel_provider
    LEFT JOIN interactions i ON (i.id_person_conversation IN (
      SELECT pc.id FROM person_conversation pc WHERE pc.id_conversation = c.id)
      OR i.id_system_conversation = sc.id)
    GROUP BY cp.name ORDER BY messages DESC
  ) t;
$$;
