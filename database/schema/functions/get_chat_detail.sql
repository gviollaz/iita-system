-- Retorna detalle completo de un chat: persona, canal, mensajes, IA, ads, media
-- Autor: gviollaz + Claude Opus 4.6 | Fecha: 2026-02-18
-- Fix 2026-02-20: campo 'url' computado para media (antes solo retornaba content_dir)
CREATE OR REPLACE FUNCTION get_chat_detail(p_conversation_id integer)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result json;
  v_pc_id integer;
  v_sc_id integer;
  v_storage_base text := 'https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/object/public/';
BEGIN
  SELECT pc.id, sc.id INTO v_pc_id, v_sc_id
  FROM conversations c
  JOIN person_conversation pc ON pc.id_conversation = c.id
  JOIN system_conversation sc ON sc.id_conversation = c.id
  WHERE c.id = p_conversation_id;

  IF v_pc_id IS NULL THEN
    RETURN json_build_object('error', 'Conversation not found');
  END IF;

  SELECT json_build_object(
    'conversation', json_build_object('id', p_conversation_id),
    'system_conversation_id', v_sc_id,
    'person', (SELECT row_to_json(pp) FROM (
      SELECT p.id, p.first_name, p.last_name, p.email, p.birth_date,
             p.location_address, p.country, p.state_province,
             p.national_id, p.creation_datetime
      FROM person_conversation pc2 JOIN persons p ON p.id = pc2.id_person
      WHERE pc2.id = v_pc_id) pp),
    'person_id', (SELECT pc2.id_person FROM person_conversation pc2 WHERE pc2.id = v_pc_id),
    'person_address', (SELECT pc2.address FROM person_conversation pc2 WHERE pc2.id = v_pc_id),
    'channel', (SELECT row_to_json(ch_row) FROM (
      SELECT ch.id, ch.name, ch.address, ch.id_channel_provider, ch.branch_id,
        json_build_object('name', cp.name) AS channel_providers,
        json_build_object('name', b.name) AS branches
      FROM system_conversation sc2
      JOIN channels ch ON ch.id = sc2.id_channel
      JOIN channel_providers cp ON cp.id = ch.id_channel_provider
      LEFT JOIN branches b ON b.id = ch.branch_id
      WHERE sc2.id = v_sc_id) ch_row),
    'messages', (SELECT COALESCE(json_agg(row_to_json(m) ORDER BY m.time_stamp), '[]'::json) FROM (
      SELECT i.id, i.text, i.time_stamp, i.status, i.external_ref, i.ad_id, 'in' AS direction
      FROM interactions i WHERE i.id_person_conversation = v_pc_id
      UNION ALL
      SELECT i.id, i.text, i.time_stamp, i.status, i.external_ref, NULL AS ad_id, 'out' AS direction
      FROM interactions i WHERE i.id_system_conversation = v_sc_id) m),
    'ai_interactions', (SELECT COALESCE(json_object_agg(
      ai.associated_interaction_id::text,
      json_build_object('id', ai.id, 'associated_interaction_id', ai.associated_interaction_id,
        'generated_interaction_id', ai.generated_interaction_id,
        'response', ai.response, 'evaluation', ai.evaluation)), '{}'::json)
      FROM ai_interaction ai
      WHERE ai.associated_interaction_id IN (
        SELECT i.id FROM interactions i WHERE i.id_person_conversation = v_pc_id)),
    'ads', (SELECT COALESCE(json_object_agg(
      a.id::text,
      json_build_object('id', a.id, 'title', a.title, 'course_id', a.course_id,
        'courses', (SELECT json_build_object('name', co.name) FROM courses co WHERE co.id = a.course_id),
        'ad_provider_id', a.ad_provider_id,
        'ad_providers', (SELECT json_build_object('name', ap.name) FROM ad_providers ap WHERE ap.id = a.ad_provider_id))), '{}'::json)
      FROM ads a WHERE a.id IN (
        SELECT DISTINCT i.ad_id FROM interactions i
        WHERE i.id_person_conversation = v_pc_id AND i.ad_id IS NOT NULL)),
    'media', (SELECT COALESCE(json_object_agg(k, v), '{}'::json) FROM (
      SELECT im.interaction_id::text AS k,
        json_agg(json_build_object(
          'id', med.id, 'name', med.name, 'content_dir', med.content_dir,
          'url', CASE
            WHEN med.content_dir LIKE 'http%' THEN med.content_dir
            WHEN med.content_dir IS NOT NULL THEN v_storage_base || replace(med.content_dir, ' ', '%20')
            ELSE NULL END,
          'type', med.type, 'description', med.description)) AS v
      FROM interaction_medias im JOIN medias med ON med.id = im.media_id
      WHERE im.interaction_id IN (
        SELECT i.id FROM interactions i WHERE i.id_person_conversation = v_pc_id
        UNION ALL
        SELECT i.id FROM interactions i WHERE i.id_system_conversation = v_sc_id)
      GROUP BY im.interaction_id) media_groups)
  ) INTO result;
  RETURN result;
END;
$$;
