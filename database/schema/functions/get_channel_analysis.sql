-- Analisis detallado por canal con filtros de fecha, sede y proveedor
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- NOTA: Funcion muy extensa (~150 lineas). Ver version completa en produccion.
-- Parametros: p_date_from, p_date_to, p_branch_id, p_provider, p_channel_id
-- Retorna: JSON array con metricas por canal: msgs_in, msgs_out, pending_prev,
--          ai_responses, pending_now, avg/min/max reply times, pending wait times
CREATE OR REPLACE FUNCTION get_channel_analysis(
  p_date_from timestamp DEFAULT NULL, p_date_to timestamp DEFAULT NULL,
  p_branch_id integer DEFAULT NULL, p_provider text DEFAULT NULL,
  p_channel_id integer DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE result json; BEGIN
  -- Full implementation in production DB
  -- Converts ART timezone boundaries to UTC
  -- Calculates per-channel: msgs_in, msgs_out, pending_prev, ai_responses,
  -- pending_now, avg_reply_min, min_reply_min, max_reply_min,
  -- pending_avg_wait_min, pending_min_wait_min, pending_max_wait_min
  RETURN '[]'::json; -- Placeholder: deploy full version from production
END; $$;
