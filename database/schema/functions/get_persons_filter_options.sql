-- Opciones de filtro para el listado de personas (tags, provincias, paises, totales)
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_persons_filter_options()
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN
  -- Full implementation in production DB
  RETURN '{}'::json;
END; $$;
