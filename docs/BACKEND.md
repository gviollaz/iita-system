# IITA CRM — Documentación Backend

> **Última actualización:** 2026-02-18 · **Edge Function v14** · **Supabase proyecto:** `cpkzzzwncpbzexpesock` (iita-base)

---

## Arquitectura general

```
[Frontend React]  ──POST──▶  [Edge Function crm-api]  ──▶  [PostgreSQL Supabase]
      │                                                           │
      └──RPC REST──▶  [Supabase PostgREST]  ─────────────────────┘
                                                                  │
                                              [Triggers]  ──webhook──▶  [Make (Integromat)]
                                                                              │
                                                                    ▼
                                                          [WhatsApp / Instagram / etc.]
```

El backend consta de:
1. **Edge Function `crm-api`** — API central que expone endpoints CRUD y especializados
2. **PostgreSQL** — 30 tablas con RLS, triggers, y 16 funciones RPC
3. **Make (Integromat)** — Automatizaciones de envío/recepción de mensajes via webhooks

---

## Edge Function: `crm-api`

- **Runtime:** Deno (Supabase Edge Functions)
- **Versión actual:** v14
- **URL:** `https://cpkzzzwncpbzexpesock.supabase.co/functions/v1/crm-api`
- **Método:** POST (JSON body)
- **JWT:** Deshabilitado (⚠️ pendiente de securizar — ver CHANGELOG)

### Endpoints disponibles

| Endpoint | Params requeridos | Descripción |
|----------|-------------------|-------------|
| `conversations` | `provider?`, `channel_id?`, `branch_id?`, `status?`, `search?`, `page?`, `limit?`, `date_from?`, `date_to?` | Lista conversaciones con filtros (usa RPC `get_conversations`) |
| `chat` | `conversation_id` | Chat completo: mensajes, persona, canal, IA, ads, medias. Retorna `system_conversation_id` para envío |
| `channels` | — | Lista canales con provider y branch |
| `branches` | — | Lista sedes |
| `stats` | — | KPIs del dashboard (usa RPC `get_crm_stats`) |
| `msgs_per_day` | `days?` (default 30) | Mensajes por día para gráfico |
| `volume_by_channel` | — | Volumen agrupado por canal |
| `volume_by_provider` | — | Volumen agrupado por proveedor |
| `channel_analysis` | `date_from?`, `date_to?`, `branch_id?`, `provider?`, `channel_id?` | Análisis detallado por canal |
| `top_leads` | `limit?` (default 20) | Leads con más interacciones |
| `unanswered` | `limit?` (default 30) | Conversaciones sin respuesta |
| `person_detail` | `person_id` | Detalle completo de persona |
| `person_full` | `person_id` | Perfil full con soft_data y contactos |
| `search_persons` | `search?`, `page?`, `limit?` | Búsqueda de personas |
| `person_conversations` | `person_id` | Conversaciones de una persona |
| `persons_enriched` | `search?`, `tag_curso?`, `provincia?`, `pais?`, `has_phone?`, `has_email?`, `page?`, `limit?` | Lista enriquecida con soft_data |
| `persons_filter_options` | — | Tags, provincias y países disponibles para filtros |
| `send_to_person` | `person_id`, `person_address`, `channel_id`, `text?`, `attachment_url?` | Envío de mensaje (crea conversación si no existe) |
| `persons_list` | `search?`, `provider?`, `has_email?`, `page?`, `limit?` | Lista legacy con channel_addresses |
| `update_person` | `person_id`, `updates` | Actualización de datos de persona |

### CRUD genérico

La Edge Function también expone un CRUD genérico para cualquier tabla:

```json
{ "action": "select", "table": "courses", "select": "*", "filters": [{"col":"disable","op":"eq","val":false}], "order": {"col":"name","asc":true} }
{ "action": "insert", "table": "persons", "data": { "first_name": "Juan" } }
{ "action": "update", "table": "ai_interaction", "data": { "evaluation": "approved" }, "id": 123 }
{ "action": "delete", "table": "courses", "id": 456 }
{ "action": "soft_delete", "table": "courses", "id": 789 }
```

> ⚠️ **Riesgo de seguridad:** El CRUD genérico permite operar sobre CUALQUIER tabla sin validación. Está pendiente implementar una whitelist de tablas permitidas.

### Deploy de la Edge Function

```bash
# Desde Supabase CLI
supabase functions deploy crm-api --project-ref cpkzzzwncpbzexpesock

# O desde el dashboard de Supabase → Edge Functions → crm-api → Deploy new version
# O desde Claude.ai usando la herramienta Supabase:deploy_edge_function
```

---

## Base de datos PostgreSQL

### Modelo de datos principal

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│   persons   │────▶│ person_conversation   │────▶│    conversations      │
│             │     │ (lado persona)        │     │ (contenedor neutral)  │
│ id          │     │ id, id_person,        │     │ id, start_date        │
│ first_name  │     │ id_conversation,      │     └───────────┬───────────┘
│ last_name   │     │ address (tel/user)    │                 │
│ email       │     └──────────┬───────────┘                 │
│ country     │                │                              │
│ ...         │     ┌──────────▼───────────┐     ┌───────────▼───────────┐
└─────────────┘     │   interactions       │     │ system_conversation   │
                    │ (mensajes)           │     │ (lado sistema)        │
                    │                      │     │ id, id_channel,       │
                    │ id                   │     │ id_conversation       │
                    │ id_person_conversation│◀───│                       │
                    │ id_system_conversation│───▶│                       │
                    │ text, time_stamp     │     └───────────────────────┘
                    │ status, ad_id        │               │
                    └──────────────────────┘     ┌─────────▼─────────┐
                              │                  │    channels       │
                    ┌─────────▼─────────┐        │ id, name, address │
                    │  ai_interaction   │        │ id_channel_provider│
                    │ associated_       │        │ branch_id         │
                    │   interaction_id  │        └───────────────────┘
                    │ response          │
                    │ evaluation        │
                    │ generated_        │
                    │   interaction_id  │
                    └───────────────────┘
```

**Regla fundamental:** Cada `interaction` tiene **exactamente una** FK activa:
- `id_person_conversation` → mensaje ENTRANTE (de la persona)
- `id_system_conversation` → mensaje SALIENTE (del sistema)
- **Nunca ambas** (protegido por constraint `chk_single_direction`)

### Tablas completas (30)

#### Core - Mensajería
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `conversations` | 25,898 | Contenedor neutral de conversación |
| `person_conversation` | 25,898 | Lado persona de la conversación (address = tel/username) |
| `system_conversation` | 25,887 | Lado sistema (vincula canal) |
| `interactions` | 102,302 | Mensajes individuales (entrantes y salientes) |
| `ai_interaction` | 11,940 | Respuestas generadas por IA |
| `interaction_medias` | 48 | Relación N:M interacción ↔ media |
| `medias` | 48 | Archivos adjuntos (imágenes, videos, docs) |

#### Core - Personas
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `persons` | 25,577 | Datos duros de contactos |
| `person_soft_data` | 75,219 | Datos flexibles (tags de curso, preferencias, etc.) |
| `person_contacts` | 21,096 | Teléfonos/cuentas por proveedor |

#### Canales y sedes
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `channel_providers` | 5 | WhatsApp, Instagram, Web, etc. |
| `channels` | 11 | Canal específico (ej: "WhatsApp Salta") |
| `branches` | 2 | Sedes físicas (Salta, San Lorenzo Chico) |

#### Cursos y pagos
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `courses` | 40 | Catálogo de cursos |
| `course_editions` | 98 | Instancias/ediciones de cada curso |
| `course_edition_schedule` | 101 | Horarios por edición |
| `course_members` | 0 | Inscripciones (pendiente de implementar) |
| `payment_tickets` | 0 | Tickets de pago (pendiente) |
| `course_tickets` | 0 | Relación pago ↔ inscripción |
| `payments` | 0 | Pagos registrados |
| `payments_logs` | 0 | Historial de cambios de estado de pagos |

#### Publicidad
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `ad_providers` | 1 | Proveedores de ads (Meta) |
| `ads` | 17 | Anuncios vinculados a cursos |

#### Sesiones virtuales
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `virtual_sessions` | 41 | Sesiones de clase virtual (Zoom) |
| `session_recording` | 37 | Grabaciones de sesiones |

#### Usuarios y permisos (sin implementar)
| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `users` | 0 | Usuarios del CRM |
| `roles` | 0 | Roles |
| `permissions` | 0 | Permisos |
| `role_permissions` | 0 | Relación rol ↔ permiso |
| `branche_users` | 0 | Relación usuario ↔ sede |

### Enums

| Enum | Valores |
|------|---------|
| `interaction_status` | `new`, `preprocessed`, `processed`, `pending_delivery`, `sending`, `send` |
| `ai_interaction_evaluation` | `pending`, `approved`, `confictive` |
| `course_edition_status` | `Enrolling`, `Pending`, `In_Progress`, `Conclude`, `Disabled` |
| `courses_modality` | `PRESENTIAL`, `VIRTUAL` |
| `courses_bill_type` | `ONLY_REGISTRATION`, `QUOTA` |
| `week_day` | `Monday` ... `Sunday` |
| `person_course_edition_status` | `on_course`, `abandoned`, `dismissed` |
| `course_participant_role` | `teacher`, `assistant`, `student`, `guest` |
| `status_ticket` | `pending`, `partial`, `paid`, `disabled` |
| `status_payment` | `queued_review`, `verified`, `conflictive`, `disabled` |
| `recording_status` | `pending`, `downloading`, `downloaded`, `uploading`, `upload` |
| `logs_authors` | `system`, `user` |

### Funciones RPC principales

| Función | Parámetros | Uso |
|---------|------------|-----|
| `get_conversations` | `p_provider, p_channel_id, p_branch_id, p_status, p_search, p_limit, p_offset, p_date_from, p_date_to` | Lista conversaciones con filtros |
| `get_persons_enriched` | `p_search, p_tag_curso, p_provincia, p_pais, p_has_phone, p_has_email, p_limit, p_offset` | Personas con soft_data y contactos |
| `get_crm_stats` | — | KPIs del dashboard |
| `get_msgs_per_day` | `p_days` | Gráfico mensajes/día |
| `get_volume_by_channel` | — | Volumen por canal |
| `get_volume_by_provider` | — | Volumen por proveedor |
| `get_channel_analysis` | `p_date_from, p_date_to, p_branch_id, p_provider, p_channel_id` | Análisis por canal |
| `get_top_leads` | `p_limit` | Leads más activos |
| `get_unanswered_conversations` | `p_limit` | Sin respuesta |
| `get_person_detail` | `p_person_id` | Detalle persona |
| `get_person_full_profile` | `p_person_id` | Perfil completo |
| `search_persons` | `p_search, p_limit, p_offset` | Búsqueda |
| `get_persons_filter_options` | — | Opciones de filtro |
| `approve_interaction` | `p_ai_id` | Aprueba respuesta IA y trigerea envío |

### Triggers y webhooks a Make

| Trigger | Evento | Tabla | Webhook Make |
|---------|--------|-------|--------------|
| `New_interaction` | INSERT | `interactions` | `av6s4jtjddg99q...` |
| `New_pending_delivery_and_send` | INSERT + UPDATE | `interactions` | `b4dwbegscrcky9...` |
| `Pre-Processing` | INSERT | `interactions` | `afn3xvc6s8mdoa...` |
| `Respond Generation - Prod` | UPDATE | `ai_interaction` | `h0ls5cnmwyiwzf...` |

> Los triggers envían notificaciones a Make que orquesta el flujo completo de mensajería: recepción → IA → revisión → envío.

---

## Flujo de un mensaje

### Mensaje entrante (persona → sistema)
1. Make recibe mensaje de WhatsApp/Instagram
2. Make busca/crea `person`, `conversation`, `person_conversation`, `system_conversation`
3. Make inserta `interaction` con `id_person_conversation`
4. Trigger `New_interaction` notifica a Make
5. Make ejecuta pre-procesamiento
6. Make genera respuesta IA → inserta en `ai_interaction` con `evaluation: 'pending'`
7. Operador revisa en CRM → aprueba/edita/rechaza
8. Si aprueba → trigger notifica Make → Make envía respuesta por el canal

### Mensaje saliente manual (CRM → persona)
1. Operador escribe mensaje en la UI de chat
2. Frontend inserta `interaction` con `id_system_conversation` (el correcto, obtenido de `chatData.system_conversation_id`)
3. Trigger `New_pending_delivery_and_send` notifica a Make
4. Make envía el mensaje por el canal correspondiente

---

## Seguridad — Estado actual y pendientes

| Aspecto | Estado | Riesgo |
|---------|--------|--------|
| Edge Function JWT | ❌ Deshabilitado | ALTO — cualquiera con la URL puede operar |
| CRUD genérico sin whitelist | ❌ Sin restricción | ALTO — permite escribir en cualquier tabla |
| RLS policies | ⚠️ `USING (true)` en la mayoría | MEDIO — no filtra por usuario |
| RPC search_path | ⚠️ Mutable en 16 funciones | MEDIO — riesgo de hijacking |
| Leaked password protection | ❌ Deshabilitado | BAJO |

---

## Operaciones comunes

### Ver logs de la Edge Function
```bash
supabase functions logs crm-api --project-ref cpkzzzwncpbzexpesock
```

### Ejecutar SQL de diagnóstico
```sql
-- Conversaciones sin respuesta en últimas 24h
SELECT * FROM get_unanswered_conversations(50);

-- Respuestas IA pendientes de revisión
SELECT count(*) FROM ai_interaction WHERE evaluation = 'pending';

-- Respuestas aprobadas pero no enviadas
SELECT count(*) FROM ai_interaction WHERE evaluation = 'approved' AND generated_interaction_id IS NULL;
```

### Deploy Edge Function desde Claude.ai
Se puede desplegar directamente usando la herramienta MCP de Supabase:
```
Supabase:deploy_edge_function con project_id: cpkzzzwncpbzexpesock
```
