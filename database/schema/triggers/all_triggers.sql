-- IITA CRM System — Triggers
-- Exported: 2026-02-20
-- Source: Supabase project cpkzzzwncpbzexpesock

-- ============================================================
-- TABLA: interactions
-- ============================================================

-- Previene insercion de mensajes duplicados (external_ref) y ecos de plataformas
-- Guard 1: Bloquea si ya existe un interaction con el mismo external_ref
-- Guard 2: Bloquea si es un mensaje 'preprocessed' identico a uno 'send' reciente (<60s)
CREATE TRIGGER trg_prevent_echo_interaction
  BEFORE INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_echo_interaction();

-- Actualiza conversations.last_activity_at cuando se inserta un mensaje
CREATE TRIGGER trg_update_conv_last_activity
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_activity();

-- Webhook a Make.com: Notifica nuevas interacciones (entrada de mensajes)
CREATE TRIGGER "New_interaction"
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://hook.us2.make.com/av6s4jtjddg99qhautn74fyemqt5udan',
    'POST', '{"Content-type":"application/json"}', '{}', '5000'
  );

-- Webhook a Make.com: Notifica cambios de estado a pending_delivery/send (dispatch)
CREATE TRIGGER "New_pending_delivery_and_send"
  AFTER INSERT OR UPDATE ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://hook.us2.make.com/b4dwbegscrcky9jtpjfgh8eywfswrx8m',
    'POST', '{"Content-type":"application/json"}', '{}', '5000'
  );

-- Webhook a Make.com: Preprocesamiento (analisis de media adjunta)
CREATE TRIGGER "Pre-Processing"
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://hook.us2.make.com/afn3xvc6s8mdoalwgyat3qurhf0o0y4p',
    'POST', '{"Content-type":"application/json"}', '{}', '5000'
  );

-- Webhook a Make.com: Generacion de respuesta IA (cuando status cambia a preprocessed)
CREATE TRIGGER "Respond Generation - Prod"
  AFTER UPDATE ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://hook.us2.make.com/h0ls5cnmwyiwzfgogcbyucodm8d8tia9',
    'POST', '{"Content-type":"application/json"}', '{}', '5000'
  );

-- ============================================================
-- TABLA: system_conversation
-- ============================================================

-- Previene conversaciones duplicadas (mismo address + channel)
CREATE TRIGGER trg_prevent_dup_conversation
  BEFORE INSERT ON public.system_conversation
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_conversation();
