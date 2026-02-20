-- Busca personas con 2+ mensajes entrantes no analizadas aun
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-20
CREATE OR REPLACE FUNCTION get_persons_for_analysis(p_limit integer DEFAULT 100)
RETURNS TABLE(person_id integer, incoming_count bigint, total_chars bigint)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT pc.id_person as person_id,
    COUNT(i.id) as incoming_count,
    COALESCE(SUM(LENGTH(i.text)), 0) as total_chars
  FROM interactions i
  JOIN person_conversation pc ON i.id_person_conversation = pc.id
  WHERE i.status = 'preprocessed'
    AND i.text IS NOT NULL AND i.text != ''
    AND i.text NOT LIKE 'Respondido desde%'
    AND pc.id_person NOT IN (SELECT el.person_id FROM person_enrichment_log el)
  GROUP BY pc.id_person
  HAVING COUNT(i.id) >= 2
  ORDER BY pc.id_person ASC
  LIMIT p_limit;
$$;
