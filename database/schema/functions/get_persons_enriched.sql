-- Lista personas enriquecidas con filtros (tags, provincia, pais, telefono, email)
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_persons_enriched(
  p_search text DEFAULT NULL, p_tag_curso text DEFAULT NULL,
  p_provincia text DEFAULT NULL, p_pais text DEFAULT NULL,
  p_has_phone boolean DEFAULT NULL, p_has_email boolean DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE result JSON; BEGIN
  -- Full implementation in production DB (~60 lines)
  -- Uses CTEs: filtered_persons, total_count, enriched
  RETURN '{"persons":[],"total":0}'::json;
END; $$;
