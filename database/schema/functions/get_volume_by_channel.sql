-- Volumen de mensajes por canal
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_volume_by_channel()
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT cp.name AS provider, ch.name AS channel, b.name AS branch,
      COUNT(i.id) AS total,
      COUNT(i.id) FILTER (WHERE i.time_stamp > NOW() - INTERVAL '7 days') AS last_7d,
      COUNT(i.id) FILTER (WHERE i.time_stamp > NOW() - INTERVAL '24 hours') AS last_24h
    FROM interactions i
    JOIN system_conversation sc ON sc.id = i.id_system_conversation
    JOIN channels ch ON ch.id = sc.id_channel
    JOIN channel_providers cp ON cp.id = ch.id_channel_provider
    LEFT JOIN branches b ON b.id = ch.branch_id
    GROUP BY cp.name, ch.name, b.name ORDER BY total DESC
  ) t;
$$;
