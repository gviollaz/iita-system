# Changelog — IITA CRM System

Formato basado en [Keep a Changelog](https://keepachangelog.com/).

---

## [2026-02-21] — Actualizacion CLAUDE.md + Features deseadas

**Autor:** gviollaz | **IA:** Claude Opus 4.6 via Claude Code

### Actualizado
- CLAUDE.md ampliado con arquitectura, frontend, DB, Edge Functions, convenciones, checklist post-cambios

### Agregado
- FEAT-019: Canal TikTok (deseado)
- FEAT-020: Canal Discord (deseado)
- FEAT-021: Canal Sitio Web — widget de chat embebible (deseado)
- FEAT-022: Canal YouTube — mensajes directos (deseado)
- FEAT-023: Vista de mapa para leads y clientes (deseado)
- FEAT-024: Rate limiting y control de consumo de IA (deseado)
- FEAT-025: Control de ventanas de tiempo por canal, alertas de vencimiento y estadisticas (deseado, P1)
- FEAT-026: Mensajeria alternativa fuera de ventana — fallback a email/SMS, terceros, automatizacion (deseado)
- FEAT-027: Optimizacion inteligente de horarios de envio — analisis de patrones por persona y global (deseado)
- FEAT-028: Silenciar IA por persona — modo "canal manual" desde flujo de aprobacion (deseado, P1)
- FEAT-029: Composicion de mensajes con asistente IA on-demand y adjuntos (deseado, P1)
- FEAT-030: Dashboard de costos operativos — tracking de gastos de IA, Make.com, canales, storage (deseado)
- FEAT-031: Banco de respuestas pre-generadas para leads nuevos — reduce costos y mejora velocidad (deseado)
- FEAT-032: Reactivacion automatica de conversaciones sin respuesta — cron + IA + limites anti-spam (deseado, P1)
- FEAT-033: Campanas de marketing pago en Meta — Ads automatizados por calendario y etiquetas (deseado)
- Fase 8 en ROADMAP: Nuevos canales de comunicacion

---

## [2026-02-20] — Repositorio unificado + Fix media

**Autor:** gviollaz | **IA:** Claude Opus 4.6 via Claude Code

### Agregado
- Repositorio unificado `iita-system` con documentacion completa
- CLAUDE.md, AGENTS.md, CONTRIBUTING.md en la raiz
- Documentacion: data-dictionary, ERD, bugs, features, roadmap, propuestas, operaciones, politicas
- Edge Functions exportadas: crm-api (v19), courses-crud (v1), create-test-user (v2)
- Schema SQL: 30 tablas, 24 funciones RPC, 7 triggers, 13 enums

### Corregido
- **Bug critico:** Imagenes/videos no se mostraban en el chat del CRM
  - Causa: `get_chat_detail` retornaba `content_dir` (path relativo) pero frontend esperaba `url`
  - Fix: Migracion `fix_media_url_in_get_chat_detail` — campo `url` computado con URL publica de Storage

## [2026-02-19] — Prevencion de ecos + Enriquecimiento

**Autor:** gviollaz | **IA:** Claude Opus 4.6 via Claude Code

### Corregido
- **Bug P0:** Mensajes eco de Instagram/WhatsApp duplicados
  - Fix: Trigger `prevent_echo_interaction()` (dedup external_ref + echo text <60s)

### Limpieza de datos
- 156 mensajes eco historicos eliminados
- 179 external_ref duplicados corregidos

### Agregado
- Script de enriquecimiento `analyze-conversations.mjs` (procesando ~25K personas con gpt-4o-mini)
- Tabla `person_enrichment_log` para tracking

## [2026-02-18] — Optimizaciones y funcionalidad core

**Autor:** gviollaz | **IA:** Claude Opus 4.6 via Claude Code

### Agregado
- RPC `get_chat_detail` (reemplaza 7 queries por 1, mejora 3-5x)
- RPC `get_conversations` (CTEs optimizados, LATERAL joins)
- RPC `process_incoming_message` (transaccion atomica: persona+conversacion+interaccion)
- RPC `process_outgoing_message`, `process_echo_message`
- RPC `approve_ai_response`, `reject_ai_response` (idempotencia, deadline 24h)
- RPCs de analytics: `get_crm_stats`, `get_msgs_per_day`, `get_volume_by_channel`, etc.
- RPCs de personas: `get_person_detail`, `get_person_full_profile`, `get_persons_enriched`, etc.
- Campo `last_activity_at` + trigger + indice en `conversations`
- Constraint `chk_single_direction` en `interactions`
- Trigger `prevent_duplicate_conversation`

## [2026-02-12 a 2026-02-17] — Setup inicial

**Autor:** gviollaz | **IA:** Varias (ChatGPT, Claude)

### Agregado
- Frontend CRM con React 19 + Vite 6
- Dashboard, Conversations, People, Courses
- Edge Functions crm-api, courses-crud
- Estructura de tablas en Supabase
- Integracion con Make.com
