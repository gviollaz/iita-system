-- Volumen de mensajes por dia (ultimos N dias)
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_msgs_per_day(p_days integer DEFAULT 30)
RETURNS json LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT d::date AS day,
      COUNT(i.id) FILTER (WHERE i.id_person_conversation IS NOT NULL) AS msgs_in,
      COUNT(i.id) FILTER (WHERE i.id_system_conversation IS NOT NULL) AS msgs_out
    FROM generate_series(
      (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - (p_days||' days')::interval,
      (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, '1 day') d
    LEFT JOIN interactions i
      ON (i.time_stamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = d::date
    GROUP BY d::date ORDER BY d::date
  ) t;
$$;
