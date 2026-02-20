-- KPIs generales del CRM
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
CREATE OR REPLACE FUNCTION get_crm_stats()
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE result json; BEGIN
  SELECT json_build_object(
    'total_conversations', (SELECT COUNT(*) FROM conversations),
    'unanswered', (SELECT COUNT(*) FROM conversations c
      JOIN person_conversation pc ON pc.id_conversation = c.id
      JOIN system_conversation sc ON sc.id_conversation = c.id
      WHERE (SELECT COUNT(*) FROM interactions i WHERE i.id_person_conversation = pc.id) > 0
        AND (SELECT COUNT(*) FROM interactions i WHERE i.id_system_conversation = sc.id) = 0),
    'ai_pending', (SELECT COUNT(*) FROM ai_interaction WHERE evaluation = 'pending'),
    'total_persons', (SELECT COUNT(*) FROM persons),
    'msgs_24h', (SELECT COUNT(*) FROM interactions WHERE time_stamp > NOW() - INTERVAL '24 hours'),
    'msgs_7d', (SELECT COUNT(*) FROM interactions WHERE time_stamp > NOW() - INTERVAL '7 days')
  ) INTO result;
  RETURN result;
END; $$;
