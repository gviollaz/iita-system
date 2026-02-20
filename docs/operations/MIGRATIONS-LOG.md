# Log de Migraciones

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Convenciones

- Las migraciones se aplican en Supabase via el dashboard o la herramienta MCP.
- Cada migracion tiene un nombre en `snake_case` descriptivo.
- Se documenta el SQL de rollback para poder revertir si es necesario.
- Las migraciones se listan en orden cronologico inverso (mas recientes primero).

---

## Migraciones Aplicadas

### fix_media_url_in_get_chat_detail

- **Fecha:** 2026-02-20
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Corrige la funcion `get_chat_detail` para incluir la URL de media en los resultados. Agrega JOIN con `interaction_medias` y `medias` para devolver el campo `media_url` junto con cada interaccion que tenga media asociada.
- **Resuelve:** BUG-R001
- **Rollback:**
```sql
-- Restaurar version anterior de get_chat_detail sin media_url
-- Requiere el SQL original de la funcion previa a esta migracion
DROP FUNCTION IF EXISTS get_chat_detail(bigint);
-- Recrear con la version anterior (ver snapshot previo)
```

---

### prevent_echo_interaction

- **Fecha:** 2026-02-19
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea un trigger `trg_prevent_echo_interaction` en la tabla `interactions` que detecta y bloquea la insercion de mensajes eco. Un mensaje eco es un mensaje saliente cuyo `external_ref` ya existe como mensaje en la misma conversacion. El trigger levanta una excepcion para cancelar el INSERT.
- **Resuelve:** BUG-R002
- **Rollback:**
```sql
DROP TRIGGER IF EXISTS trg_prevent_echo_interaction ON interactions;
DROP FUNCTION IF EXISTS prevent_echo_interaction();
```

---

### enrichment_infrastructure

- **Fecha:** 2026-02-19
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea la infraestructura necesaria para el enriquecimiento de datos de personas con IA. Incluye la tabla `person_enrichment_log` para registrar el estado de procesamiento de cada persona y ajustes en `person_soft_data` para soportar datos enriquecidos.
- **Rollback:**
```sql
DROP TABLE IF EXISTS person_enrichment_log;
-- Revertir ajustes en person_soft_data segun corresponda
```

---

### get_chat_detail

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea la funcion RPC `get_chat_detail(p_conversation_id bigint)` que devuelve el detalle completo de una conversacion: interacciones ordenadas cronologicamente, datos de persona, canal, y respuestas de IA asociadas.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS get_chat_detail(bigint);
```

---

### get_conversations

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea la funcion RPC `get_conversations` que devuelve la lista de conversaciones con filtros por canal, estado, fecha y paginacion. Incluye ultimo mensaje, nombre de persona y canal.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS get_conversations;
```

---

### process_incoming_message

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea la funcion `process_incoming_message` que encapsula la logica de procesamiento de un mensaje entrante: busca o crea persona, busca o crea conversacion, crea interaccion y vincula persona-conversacion.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS process_incoming_message;
```

---

### approve_reject_ai_response

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea la funcion RPC `approve_ai_response` que permite aprobar o rechazar una respuesta generada por IA. Cambia el status en `ai_interaction` de `pending` a `approved` o `conflictive` y registra quien realizo la accion.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS approve_ai_response;
```

---

### add_last_activity_at

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Agrega la columna `last_activity_at` a la tabla `conversations` y crea el trigger `trg_update_last_activity` que actualiza automaticamente este campo cuando se inserta una nueva interaccion en la conversacion.
- **Rollback:**
```sql
DROP TRIGGER IF EXISTS trg_update_last_activity ON interactions;
DROP FUNCTION IF EXISTS update_conversation_last_activity();
ALTER TABLE conversations DROP COLUMN IF EXISTS last_activity_at;
```

---

### chk_single_direction

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Agrega un constraint CHECK en la tabla `interactions` para validar que el campo `direction` solo contenga valores validos (`incoming` o `outgoing`). Previene datos inconsistentes.
- **Rollback:**
```sql
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS chk_single_direction;
```

---

### prevent_duplicate_conversation

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea el trigger `trg_prevent_duplicate_conversation` que previene la creacion de conversaciones duplicadas. Usa `FOR UPDATE` para manejar condiciones de carrera cuando multiples webhooks de Make.com intentan crear la misma conversacion simultaneamente.
- **Resuelve:** BUG-R003
- **Rollback:**
```sql
DROP TRIGGER IF EXISTS trg_prevent_duplicate_conversation ON person_conversation;
DROP FUNCTION IF EXISTS prevent_duplicate_conversation();
```

---

### analytics_rpcs

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea las funciones RPC de analytics para el dashboard: `get_crm_stats`, `get_msgs_per_day`, `get_volume_by_channel`, `get_volume_by_provider`, `get_top_leads`, `get_unanswered_conversations`, `get_channel_analysis`.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS get_crm_stats();
DROP FUNCTION IF EXISTS get_msgs_per_day();
DROP FUNCTION IF EXISTS get_volume_by_channel();
DROP FUNCTION IF EXISTS get_volume_by_provider();
DROP FUNCTION IF EXISTS get_top_leads();
DROP FUNCTION IF EXISTS get_unanswered_conversations();
DROP FUNCTION IF EXISTS get_channel_analysis;
```

---

### person_rpcs

- **Fecha:** 2026-02-18
- **Autor:** Equipo IITA + Claude
- **Descripcion:** Crea las funciones RPC de personas: `get_person_detail`, `get_person_full_profile`, `get_persons_enriched`, `get_persons_filter_options`, `search_persons`.
- **Rollback:**
```sql
DROP FUNCTION IF EXISTS get_person_detail;
DROP FUNCTION IF EXISTS get_person_full_profile;
DROP FUNCTION IF EXISTS get_persons_enriched;
DROP FUNCTION IF EXISTS get_persons_filter_options();
DROP FUNCTION IF EXISTS search_persons;
```
