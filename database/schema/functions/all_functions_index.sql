-- =============================================================
-- Funciones RPC de PostgreSQL — IITA CRM
-- Exportadas de produccion: 2026-02-20
-- Autor: gviollaz + Claude Opus 4.6
-- =============================================================
-- 24 funciones en total. Agrupadas por funcionalidad.
-- Para el codigo fuente completo de cada funcion, ver produccion.
-- =============================================================

-- =============================================
-- GRUPO 1: Procesamiento de mensajes
-- =============================================

-- process_incoming_message(p_address, p_channel_id, p_text, p_external_ref, p_person_name, p_ad_external_ref, p_username)
-- Busca/crea persona, conversacion e interaccion. Verifica duplicados por external_ref.
-- Dos versiones: 6 params (original) y 7 params (con p_username)

-- process_outgoing_message(p_address, p_channel_id, p_text, p_external_ref, p_status)
-- Registra mensaje saliente en conversacion existente.

-- process_echo_message(p_recipient_address, p_channel_id, p_text, p_external_ref)
-- Registra eco de plataforma (Meta/Instagram) como mensaje saliente.

-- find_or_create_conversation(p_address, p_channel_id, p_person_id)
-- Busca conversacion por address+channel o crea una nueva. Retorna TABLE.

-- =============================================
-- GRUPO 2: Aprobacion de IA
-- =============================================

-- approve_ai_response(p_ai_id)
-- Aprueba respuesta pendiente: crea interaccion saliente, respeta deadline 24h.
-- Idempotente. Retorna jsonb con ok/error.

-- reject_ai_response(p_ai_id)
-- Rechaza respuesta pendiente (marca como confictive). Idempotente.

-- =============================================
-- GRUPO 3: Consultas del CRM (chat, conversaciones)
-- =============================================

-- get_chat_detail(p_conversation_id)
-- Retorna JSON con: persona, canal, mensajes, ai_interactions, ads, media.
-- Fix 2026-02-20: campo url computado para media.

-- get_conversations(p_provider, p_channel_id, p_branch_id, p_status, p_search, p_limit, p_offset, p_date_from, p_date_to)
-- Lista conversaciones con filtros avanzados. Usa CTEs + LATERAL joins optimizados.

-- =============================================
-- GRUPO 4: Analytics
-- =============================================

-- get_crm_stats() — KPIs: total_conversations, unanswered, ai_pending, total_persons, msgs_24h, msgs_7d
-- get_msgs_per_day(p_days) — Volumen diario en/out ultimos N dias
-- get_volume_by_channel() — Msgs por canal con totales, 7d y 24h
-- get_volume_by_provider() — Msgs agrupados por proveedor
-- get_top_leads(p_limit) — Leads mas activos
-- get_unanswered_conversations(p_limit) — Conversaciones sin responder
-- get_channel_analysis(p_date_from, p_date_to, p_branch_id, p_provider, p_channel_id)
--   Analisis detallado: msgs in/out, pending, tiempos de respuesta por canal

-- =============================================
-- GRUPO 5: Personas
-- =============================================

-- get_person_detail(p_person_id) — Detalle con conversaciones y fuentes de ads
-- get_person_full_profile(p_person_id) — Perfil completo: datos, soft_data, contactos, stats
-- get_persons_enriched(p_search, p_tag_curso, p_provincia, ...) — Lista con filtros avanzados
-- get_persons_filter_options() — Opciones de filtro: tags, provincias, paises, totales
-- search_persons(p_search, p_limit, p_offset) — Busqueda por texto libre
-- get_persons_for_analysis(p_limit) — Personas con 2+ msgs no analizadas (para enriquecimiento)

-- =============================================
-- GRUPO 6: Trigger functions
-- =============================================

-- prevent_echo_interaction() — BEFORE INSERT interactions
--   Guard 1: Bloquea external_ref duplicados
--   Guard 2: Bloquea ecos (mismo texto <60s en mismo system_conversation)

-- prevent_duplicate_conversation() — BEFORE INSERT system_conversation
--   Previene conversaciones duplicadas (mismo address + channel)

-- update_conversation_last_activity() — AFTER INSERT interactions
--   Actualiza conversations.last_activity_at

-- =============================================
-- NOTA: Codigo fuente completo
-- =============================================
-- El codigo fuente completo de todas las funciones esta disponible en:
-- 1. Base de datos de produccion (Supabase project cpkzzzwncpbzexpesock)
-- 2. Supabase Dashboard > SQL Editor > seleccionar funcion
-- 3. Query: SELECT proname, prosrc FROM pg_proc JOIN pg_namespace ON pronamespace=oid WHERE nspname='public';
