# IITA CRM — Diccionario de datos

> **Generado desde:** PostgreSQL 17, Supabase proyecto `cpkzzzwncpbzexpesock`
> **Ultima actualizacion:** 2026-02-20
> **Generado por:** Claude Opus 4.6 (AI-assisted)

---

## Modelo de datos - Vision general

El sistema tiene 4 dominios principales:

| Dominio | Tablas | Descripcion |
|---------|--------|-------------|
| **Mensajeria** | `persons`, `conversations`, `person_conversation`, `system_conversation`, `interactions`, `ai_interaction`, `interaction_medias`, `medias`, `channels`, `channel_providers`, `branches` | Nucleo del CRM: personas, conversaciones multicanal, mensajes, respuestas IA |
| **Cursos** | `courses`, `course_editions`, `course_edition_schedule`, `course_members`, `ads`, `ad_providers` | Catalogo de cursos, ediciones, horarios, inscripciones, publicidad |
| **Pagos** | `payment_tickets`, `payments`, `payments_logs`, `course_tickets` | Sistema de pagos (diseñado pero **no implementado**, tablas vacias) |
| **RBAC** | `users`, `roles`, `permissions`, `role_permissions`, `branche_users` | Control de acceso (diseñado pero **no implementado**, tablas vacias) |
| **Auxiliar** | `person_soft_data`, `person_contacts`, `person_enrichment_log` | Datos enriquecidos, contactos por proveedor, log de enriquecimiento IA |
| **Virtual** | `virtual_sessions`, `session_recording` | Sesiones virtuales (diseñado pero **no implementado**) |

---

## Dominio: Mensajeria

### `persons` (~25,000 filas)

**Proposito:** Registro maestro de personas/leads/contactos. Una persona puede tener multiples conversaciones en diferentes canales.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `first_name` | text | SI | - | Nombre. ~71% de registros lo tienen vacio (BUG-006, enriquecimiento en curso) |
| `last_name` | text | SI | - | Apellido |
| `email` | varchar(255) | SI | - | Email principal |
| `birth_date` | date | SI | - | Fecha de nacimiento (importante para age gate en cursos) |
| `national_id` | varchar(30) | SI | - | DNI / documento de identidad |
| `country` | varchar(100) | SI | - | Pais |
| `state_province` | varchar(100) | SI | - | Provincia / Estado |
| `location_address` | text | SI | - | Direccion completa |
| `legal_guardian_id` | integer | SI | - | FK → `persons.id`. Tutor legal para menores de edad |
| `creation_datetime` | timestamp | SI | - | Fecha de creacion del registro |

**FKs:** `legal_guardian_id` → `persons.id` (self-reference para menores)
**Indices:** `persons_pkey`, `idx_persons_first_name`, `idx_persons_last_name` (sin uso), `idx_persons_email`, `idx_persons_legal_guardian_id`

---

### `conversations` (~24,000 filas)

**Proposito:** Hilo de conversacion. Una conversacion tiene exactamente 1 `person_conversation` (lado persona) y 1 `system_conversation` (lado canal/sistema). La conversacion es el contenedor que une ambos lados.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `start_date` | timestamp | SI | `now()` | Fecha de inicio de la conversacion |
| `last_activity_at` | timestamptz | SI | - | Timestamp del ultimo mensaje. Columna materializada, actualizada por trigger |

**Indices:** `conversations_pkey`, `idx_conversations_last_activity` (DESC), `idx_conversations_start_date` (DESC)
**Triggers:** `trg_update_conv_last_activity` actualiza `last_activity_at` en cada INSERT en `interactions`

---

### `person_conversation` (~24,000 filas)

**Proposito:** Tabla de union persona-conversacion. Representa el "lado persona" de una conversacion. Guarda la direccion de contacto (telefono, ID de Instagram, etc.) que identifico a la persona en esa conversacion.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `id_person` | integer | NO | - | FK → `persons.id` |
| `id_conversation` | integer | NO | - | FK → `conversations.id` |
| `address` | text | SI | - | Identificador del contacto en el canal (numero de telefono, Instagram ID, etc.) |
| `contact_username` | text | SI | - | Username de Instagram/Messenger (agregado feb 2026) |

**FKs:** `id_person` → `persons.id`, `id_conversation` → `conversations.id`
**Indices:** `person_conversation_pkey`, `idx_person_conversation_id_person`, `idx_person_conversation_id_conversation`, `person_conversation_address_idx`, `idx_person_conv_username`

---

### `system_conversation` (~24,000 filas)

**Proposito:** Tabla de union conversacion-canal. Representa el "lado sistema" de una conversacion. Define por que canal (WhatsApp, Instagram, etc.) se gestiona esa conversacion.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `id_channel` | integer | NO | - | FK → `channels.id` |
| `id_conversation` | integer | NO | - | FK → `conversations.id` |

**FKs:** `id_channel` → `channels.id`, `id_conversation` → `conversations.id`
**Indices:** `system_conversation_pkey`, `idx_system_conversation_id_channel`, `system_conversation_id_conversation_idx`
**Triggers:** `trg_prevent_dup_conversation` (BEFORE INSERT) — evita crear dos conversaciones para la misma persona+canal

---

### `interactions` (~102,000 filas)

**Proposito:** Cada mensaje individual (entrante o saliente). La direccion se determina por cual FK tiene valor: si `id_person_conversation` → entrante (del cliente), si `id_system_conversation` → saliente (del sistema). Constraint `chk_single_direction` asegura que solo una FK este activa.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `id_person_conversation` | integer | SI | - | FK → `person_conversation.id`. Si tiene valor = mensaje ENTRANTE |
| `id_system_conversation` | integer | SI | - | FK → `system_conversation.id`. Si tiene valor = mensaje SALIENTE |
| `text` | text | SI | - | Contenido del mensaje. NULL si es solo media |
| `time_stamp` | timestamp | SI | `now()` | Timestamp del mensaje |
| `status` | enum | SI | `'new'` | Ciclo de vida: `new` → `preprocessed` → `processed` → `pending_delivery` → `sending` → `send` |
| `external_ref` | text | SI | - | Referencia externa del proveedor (message ID de WhatsApp/Instagram) |
| `ad_id` | integer | SI | - | FK → `ads.id`. Si el mensaje llego por una publicidad |

**FKs:** `id_person_conversation` → `person_conversation.id`, `id_system_conversation` → `system_conversation.id`, `ad_id` → `ads.id`
**Constraints:** `chk_single_direction` — exactamente una de las dos FKs debe ser NOT NULL
**Indices:** `interactions_pkey`, `idx_interactions_person_conv_timestamp`, `idx_interactions_system_conv_timestamp`, `idx_interactions_status`, `idx_interactions_time_stamp`, `interactions_external_ref_idx`, `idx_interactions_ad_id`

**Triggers:**
- `trg_prevent_echo_interaction` (BEFORE INSERT) — bloquea ecos de Instagram/WhatsApp y external_ref duplicados
- `trg_update_conv_last_activity` (AFTER INSERT) — actualiza `conversations.last_activity_at`
- `New_interaction` (AFTER INSERT) — webhook a Make.com para procesamiento
- `Pre-Processing` (AFTER INSERT) — webhook a Make.com para analisis de media
- `Respond Generation - Prod` (AFTER UPDATE) — webhook a Make.com para generacion IA
- `New_pending_delivery_and_send` (AFTER INSERT/UPDATE) — webhook a Make.com para envio

---

### `ai_interaction` (~12,000 filas)

**Proposito:** Respuestas generadas por IA para mensajes entrantes. Cada registro es un intento de respuesta. El ciclo de evaluacion: `pending` (esperando aprobacion) → `approved` (aprobada, se envia) o `conflictive` (rechazada).

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `associated_interaction_id` | integer | NO | - | FK → `interactions.id`. El mensaje entrante al que responde |
| `generated_interaction_id` | integer | SI | - | FK → `interactions.id`. La interaccion de salida generada al aprobar. NULL si no aprobada |
| `response` | text | NO | - | Texto de la respuesta generada por IA |
| `system_prompt` | text | NO | - | Prompt completo usado para generar la respuesta |
| `evaluation` | enum | SI | - | Estado: `pending`, `approved`, `conflictive` |

**FKs:** `associated_interaction_id` → `interactions.id`, `generated_interaction_id` → `interactions.id`
**Constraints:** `idx_ai_interaction_unique_pending` — maximo 1 respuesta pendiente por interaccion
**Indices:** `ai_interaction_pkey`, `ai_interaction_associated_interaction_id_idx`, `idx_ai_interaction_evaluation`, `idx_ai_interaction_eval_assoc`, `idx_ai_interaction_pending`, `idx_ai_interaction_generated_id`

---

### `channels` (11 filas)

**Proposito:** Canales de comunicacion especificos. Cada canal pertenece a un proveedor (WhatsApp, Instagram, etc.) y a una sede (Centro, San Lorenzo).

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `id_channel_provider` | integer | NO | - | FK → `channel_providers.id` |
| `name` | text | SI | - | Nombre descriptivo (ej: "IITA Chatbot", "IITA Salta - Instagram") |
| `address` | text | SI | - | Identificador tecnico del canal (numero WA, page ID de IG, etc.) |
| `branch_id` | integer | NO | - | FK → `branches.id`. Sede a la que pertenece |
| `descrption` | text | SI | - | Descripcion (nota: typo en el nombre de columna) |

**FKs:** `id_channel_provider` → `channel_providers.id`, `branch_id` → `branches.id`

---

### `channel_providers` (5 filas)

**Proposito:** Proveedores de canales de comunicacion.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `name` | text | SI | - | Nombre: WhatsApp, Instagram, Messenger, Email, WhatsApp Coexistence |

---

### `branches` (2 filas)

**Proposito:** Sedes fisicas de IITA.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `name` | text | SI | - | Nombre: "Centro", "San Lorenzo" |
| `google_maps` | text | SI | - | Link a Google Maps |
| `location_address` | text | SI | - | Direccion fisica |

---

### `medias` (57 filas)

**Proposito:** Archivos multimedia adjuntos a interacciones. Almacenados en Supabase Storage (bucket `media`, publico).

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `name` | varchar(100) | SI | - | Nombre del archivo |
| `content_dir` | text | SI | - | Path relativo en Supabase Storage (ej: `media/interaction_medias/...`) |
| `type` | text | SI | - | Extension del archivo: `jpeg`, `mp4`, `html`. NOTA: algunos tienen MIME completo como `html; charset="utf-8"` |
| `description` | text | SI | - | Descripcion generada por IA (GPT-5.2 para imagenes, gpt-4o-mini para audio) |
| `disabled` | boolean | SI | `false` | Soft delete |

**URL publica:** `https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/object/public/{content_dir}` (con espacios como %20)

---

### `interaction_medias` (57 filas)

**Proposito:** Tabla de union interaccion-media (N:M). Una interaccion puede tener multiples medias.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `interaction_id` | integer | NO | - | FK → `interactions.id` |
| `media_id` | integer | NO | - | FK → `medias.id` |

---

## Dominio: Datos de persona

### `person_contacts` (~21,000 filas)

**Proposito:** Telefonos, emails y otros datos de contacto por proveedor. Una persona puede tener multiples contactos en diferentes proveedores.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `person_id` | integer | NO | - | FK → `persons.id` |
| `channel_provider_id` | integer | NO | - | FK → `channel_providers.id`. En que proveedor esta este contacto |
| `contact_value` | text | NO | - | Valor del contacto (numero, email, ID) |
| `external_reference` | text | SI | - | Referencia externa del proveedor |

---

### `person_soft_data` (~75,000 filas)

**Proposito:** Datos enriquecidos de contactos en formato key-value. Cada registro es un par (persona, clave, valor). Usado por el proceso de enriquecimiento IA y por Make.com.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `person_id` | integer | NO | - | FK → `persons.id` |
| `data_name` | varchar(50) | NO | - | Clave: `tag_curso`, `edad`, `localidad`, `interes`, `nombre_completo`, etc. |
| `data_content` | text | NO | - | Valor del dato |
| `datetime` | timestamp | SI | `now()` | Cuando se registro |
| `disabled` | boolean | SI | - | Soft delete |
| `editable` | boolean | SI | - | Si el operador puede editarlo |

---

### `person_enrichment_log` (tracking de enriquecimiento)

**Proposito:** Log del proceso de enriquecimiento IA. Un registro por persona analizada. Evita reprocesar la misma persona.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `person_id` | integer | NO | - | FK → `persons.id`. UNIQUE — una persona se analiza una vez |
| `analyzed_at` | timestamp | NO | `now()` | Cuando se analizo |
| `model_used` | text | NO | default | Modelo IA usado (ej: `gpt-4o-mini`) |
| `script_version` | text | NO | `'1.0'` | Version del script de analisis |
| `status` | text | NO | `'ok'` | Estado: `ok`, `error`, `dry_run` |
| `confidence` | text | SI | - | Nivel de confianza de la IA |
| `incoming_msgs` | integer | SI | - | Cantidad de mensajes entrantes analizados |
| `transcript_chars` | integer | SI | - | Caracteres totales del transcript |
| `tags_found` | text[] | SI | - | Tags de cursos detectados |
| `fields_inserted` | text[] | SI | - | Campos insertados en person_soft_data |
| `fields_skipped` | text[] | SI | - | Campos omitidos (ya existian) |
| `raw_extraction` | jsonb | SI | - | Extraccion completa de la IA en JSON |
| `error_detail` | text | SI | - | Detalle del error si status='error' |

---

## Dominio: Cursos

### `courses` (40 filas)

**Proposito:** Catalogo de cursos de IITA.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `name` | varchar(100) | SI | - | Nombre del curso |
| `bill_type` | enum | SI | `'ONLY_REGISTRATION'` | Tipo de cobro: `ONLY_REGISTRATION`, `REGISTRATION_AND_QUOTA` |
| `registration_price` | float | SI | - | Precio de inscripcion |
| `quota_price` | float | SI | - | Precio de cuota mensual |
| `duration` | text | SI | - | Duracion del curso |
| `description` | text | SI | - | Descripcion |
| `playlist_name` | text | SI | - | Nombre de playlist de video |
| `disable` | boolean | SI | `false` | Soft delete |

---

### `course_editions` (98 filas)

**Proposito:** Ediciones/cohortes de un curso. Cada edicion tiene fechas, capacidad, rango de edad y sede.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `course_id` | integer | NO | - | FK → `courses.id` |
| `status` | enum | SI | `'Enrolling'` | Estado: `Enrolling` → `Pending` → `In_Progress` → `Conclude` → `Disabled` |
| `student_capacity` | integer | SI | - | Capacidad maxima |
| `tentative_start_date` | date | SI | - | Fecha tentativa de inicio |
| `tentative_end_date` | date | SI | - | Fecha tentativa de fin |
| `min_age` | integer | SI | - | Edad minima |
| `max_age` | integer | SI | - | Edad maxima |
| `detail` | text | SI | - | Detalle adicional |
| `modality` | enum | SI | - | Modalidad: presencial, virtual, hibrido |
| `branch_id` | integer | SI | - | FK → `branches.id`. Sede |

---

### `course_edition_schedule`

**Proposito:** Horarios de cada edicion de curso (dias y horas de clase).

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `course_edition_id` | integer | NO | - | FK → `course_editions.id` |
| `class_day` | enum | SI | - | Dia de la semana |
| `start_time` | time | SI | - | Hora de inicio |
| `end_time` | time | SI | - | Hora de fin |
| `disabled_date` | timestamp | SI | - | Si se deshabilito este horario |

---

### `course_members` (vacio)

**Proposito:** Inscripciones de personas a ediciones de curso.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `course_edition_id` | integer | NO | - | FK → `course_editions.id` |
| `person_id` | integer | NO | - | FK → `persons.id` |
| `status` | enum | SI | - | Estado de inscripcion |
| `role` | enum | SI | `'student'` | Rol: `student`, `teacher`, etc. |

---

### `ads` (17 filas)

**Proposito:** Publicidades que generan leads. Vincula un anuncio con un curso y un proveedor de ads.

| Columna | Tipo | Null | Default | Descripcion |
|---------|------|------|---------|-------------|
| `id` | integer | NO | autoincrement | PK |
| `ad_provider_id` | integer | NO | - | FK → `ad_providers.id` |
| `course_id` | integer | SI | - | FK → `courses.id`. Curso al que refiere la publicidad |
| `title` | text | SI | - | Titulo del anuncio |
| `external_ref` | text | SI | - | ID externo del anuncio en la plataforma |

---

## Dominio: Pagos (NO IMPLEMENTADO - tablas vacias)

### `payment_tickets`, `payments`, `payments_logs`, `course_tickets`

Tablas diseñadas para gestionar pagos de inscripciones y cuotas. Actualmente vacias y sin logica implementada.

---

## Dominio: RBAC (NO IMPLEMENTADO - tablas vacias)

### `users`, `roles`, `permissions`, `role_permissions`, `branche_users`

Tablas diseñadas para control de acceso basado en roles. Actualmente vacias. Edge Functions no usan JWT.

---

## Foreign Keys completas

| Tabla | Columna | Referencia |
|-------|---------|------------|
| `ads` | `ad_provider_id` | `ad_providers.id` |
| `ads` | `course_id` | `courses.id` |
| `ai_interaction` | `associated_interaction_id` | `interactions.id` |
| `ai_interaction` | `generated_interaction_id` | `interactions.id` |
| `branche_users` | `branch_id` | `branches.id` |
| `branche_users` | `user_id` | `users.id` |
| `channels` | `id_channel_provider` | `channel_providers.id` |
| `channels` | `branch_id` | `branches.id` |
| `course_edition_schedule` | `course_edition_id` | `course_editions.id` |
| `course_editions` | `course_id` | `courses.id` |
| `course_editions` | `branch_id` | `branches.id` |
| `course_members` | `course_edition_id` | `course_editions.id` |
| `course_members` | `person_id` | `persons.id` |
| `course_tickets` | `payment_ticket_id` | `payment_tickets.id` |
| `course_tickets` | `course_member_id` | `course_members.id` |
| `interaction_medias` | `interaction_id` | `interactions.id` |
| `interaction_medias` | `media_id` | `medias.id` |
| `interactions` | `id_person_conversation` | `person_conversation.id` |
| `interactions` | `id_system_conversation` | `system_conversation.id` |
| `interactions` | `ad_id` | `ads.id` |
| `payments` | `payment_ticket_id` | `payment_tickets.id` |
| `payments_logs` | `payment_id` | `payments.id` |
| `person_contacts` | `person_id` | `persons.id` |
| `person_contacts` | `channel_provider_id` | `channel_providers.id` |
| `person_conversation` | `id_person` | `persons.id` |
| `person_conversation` | `id_conversation` | `conversations.id` |
| `person_enrichment_log` | `person_id` | `persons.id` |
| `person_soft_data` | `person_id` | `persons.id` |
| `persons` | `legal_guardian_id` | `persons.id` |
| `role_permissions` | `role_id` | `roles.id` |
| `role_permissions` | `permission_id` | `permissions.id` |
| `session_recording` | `id_virtual_session` | `virtual_sessions.id` |
| `system_conversation` | `id_channel` | `channels.id` |
| `system_conversation` | `id_conversation` | `conversations.id` |
| `users` | `role_id` | `roles.id` |
| `virtual_sessions` | `id_course_edition` | `course_editions.id` |

---

## Triggers

| Tabla | Trigger | Timing | Evento | Funcion | Descripcion |
|-------|---------|--------|--------|---------|-------------|
| `interactions` | `trg_prevent_echo_interaction` | BEFORE | INSERT | `prevent_echo_interaction()` | Bloquea ecos de Instagram/WA y external_ref duplicados |
| `interactions` | `trg_update_conv_last_activity` | AFTER | INSERT | `update_conversation_last_activity()` | Actualiza `conversations.last_activity_at` |
| `interactions` | `New_interaction` | AFTER | INSERT | Webhook Make.com | Notifica nuevo mensaje para procesamiento |
| `interactions` | `Pre-Processing` | AFTER | INSERT | Webhook Make.com | Notifica para analisis de media |
| `interactions` | `Respond Generation - Prod` | AFTER | UPDATE | Webhook Make.com | Notifica para generacion de respuesta IA |
| `interactions` | `New_pending_delivery_and_send` | AFTER | INSERT/UPDATE | Webhook Make.com | Notifica para envio de mensajes |
| `system_conversation` | `trg_prevent_dup_conversation` | BEFORE | INSERT | `prevent_duplicate_conversation()` | Evita conversaciones duplicadas persona+canal |

---

## Funciones RPC

| Funcion | Parametros | Retorna | Security | search_path |
|---------|------------|---------|----------|-------------|
| `approve_ai_response` | `p_ai_id int` | jsonb | DEFINER | ✅ public |
| `reject_ai_response` | `p_ai_id int` | jsonb | DEFINER | ✅ public |
| `get_chat_detail` | `p_conversation_id int` | json | DEFINER | ✅ public |
| `get_conversations` | 9 params (filtros) | json | INVOKER | ❌ mutable |
| `get_crm_stats` | - | json | DEFINER | ❌ mutable |
| `get_msgs_per_day` | `p_days int` | json | DEFINER | ❌ mutable |
| `get_channel_analysis` | 5 params (filtros) | json | DEFINER | ❌ mutable |
| `get_volume_by_channel` | - | json | DEFINER | ❌ mutable |
| `get_volume_by_provider` | - | json | DEFINER | ❌ mutable |
| `get_top_leads` | `p_limit int` | json | DEFINER | ❌ mutable |
| `get_unanswered_conversations` | `p_limit int` | json | DEFINER | ❌ mutable |
| `get_person_detail` | `p_person_id int` | json | DEFINER | ❌ mutable |
| `get_person_full_profile` | `p_person_id int` | json | INVOKER | ❌ mutable |
| `get_persons_enriched` | 8 params (filtros) | json | DEFINER | ❌ mutable |
| `get_persons_filter_options` | - | json | DEFINER | ❌ mutable |
| `search_persons` | 3 params | json | DEFINER | ❌ mutable |
| `find_or_create_conversation` | 3 params | TABLE | INVOKER | ❌ mutable |
| `get_persons_for_analysis` | `p_limit int` | TABLE | INVOKER | ✅ public |
| `process_incoming_message` | 6-7 params | jsonb | INVOKER | ✅ public |
| `process_outgoing_message` | 5 params | jsonb | INVOKER | ✅ public |
| `process_echo_message` | 4 params | jsonb | INVOKER | ✅ public |
| `prevent_echo_interaction` | - | trigger | INVOKER | ✅ public |
| `prevent_duplicate_conversation` | - | trigger | INVOKER | ❌ mutable |
| `update_conversation_last_activity` | - | trigger | INVOKER | ❌ mutable |

**⚠ Seguridad:** 15 funciones con `search_path` mutable (vulnerabilidad de inyeccion de schema).
