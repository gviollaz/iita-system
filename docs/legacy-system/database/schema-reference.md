# Referencia de Esquema — Base de Datos Legacy

Última actualización: 2026-02-21 | Validado contra datos de producción  
Proyecto Supabase: `kdwdknuhowdehknztark` (chatbot Legacy — prod backup)  
Motor: PostgreSQL 17.6.1 | Período de datos: mayo 2024 – diciembre 2025

## Resumen

| Categoría | Tablas | Registros totales | Tamaño total |
|-----------|--------|-------------------|--------------|
| Personas y contactos | 7 | ~123K | ~19 MB |
| Conversaciones y mensajes | 5 | ~226K | ~635 MB |
| Etiquetas e intereses | 4 | ~25.7K | ~1.1 MB |
| Cursos | 2 | 62 | ~176 KB |
| IA y respondents | 8 | ~64.5K | ~23 MB |
| Empresa y config | 8 | ~15 | ~240 KB |
| Django admin | 7 | ~580 | ~530 KB |
| **Total** | **41** | **~440K** | **~680 MB** |

> Nota: `core_aiinteractionlog` ocupa 572 MB (14 MB datos + 558 MB TOAST) debido a campos de texto extensos (prompts, requests).

---

## 1. Personas y Contactos

### core_persons

Tabla central de contactos/personas. Cada persona que interactúa por cualquier canal.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `first_name` | varchar(255) | SÍ | — | |
| 3 | `last_name` | varchar(255) | SÍ | — | |
| 4 | `region` | varchar(255) | SÍ | — | |
| 5 | `birthday` | date | SÍ | — | |
| 6 | `dni` | varchar(9) | SÍ | — | |
| 7 | `email` | varchar(255) | SÍ | — | |
| 8 | `ignore_feedback` | boolean | NO | — | |
| 9 | `phone_number` | varchar(255) | SÍ | — | |

**Registros:** 22,005 | **Tamaño:** 3.4 MB | **RLS:** No  
**Índices:** `core_persons_pkey` (id)

---

### core_personcomchannels

Identidad de una persona en un canal de mensajería específico. Tabla original de Django que vincula persona con proveedor de chat.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `group_address` | varchar(255) | NO | — | |
| 3 | `address` | varchar(255) | NO | — | |
| 4 | `chat_provider_id` | bigint | SÍ | — | **FK** → core_chatproviders(id) |
| 5 | `person_id` | bigint | NO | — | **FK** → core_persons(id) |
| 6 | `time_out` | timestamptz | NO | — | |

**Registros:** 20,654 | **Tamaño:** 2.7 MB | **RLS:** No  
**Índices:** `core_personcomchannels_pkey` (id), idx on `chat_provider_id`, idx on `person_id`

---

### core_person_channels

Tabla normalizada (post-migración) de canales por persona. Reemplaza a `core_personcomchannels` con estructura más limpia.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | nextval(seq) | **PK** |
| 2 | `person_id` | bigint | NO | — | **FK** → core_persons(id) |
| 3 | `platform` | varchar(50) | NO | — | |
| 4 | `platform_user_id` | varchar(200) | SÍ | — | |
| 5 | `platform_username` | varchar(200) | SÍ | — | |
| 6 | `platform_address` | varchar(200) | SÍ | — | |
| 7 | `display_name` | varchar(200) | SÍ | — | |
| 8 | `is_primary` | boolean | NO | false | |
| 9 | `is_verified` | boolean | NO | false | |
| 10 | `original_pcc_id` | bigint | SÍ | — | Ref. manual a core_personcomchannels(id) |
| 11 | `created_at` | timestamptz | NO | now() | |
| 12 | `updated_at` | timestamptz | NO | now() | |

**Registros:** 20,653 | **Tamaño:** 5.2 MB | **RLS:** Sí  
**Índices:** PK, `idx_person_channels_person` (person_id), `idx_person_channels_platform` (platform), `idx_person_channels_address` (platform_address), **UNIQUE** `idx_person_channels_unique` (person_id, platform, platform_address)

---

### core_person_profile

Perfil enriquecido 1:1 por persona. Generado principalmente desde importación de contactos y enriquecimiento con IA/minería.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `person_id` | bigint | NO | — | **PK**, **FK** → core_persons(id) |
| 2 | `localidad` | varchar(200) | SÍ | — | |
| 3 | `provincia` | varchar(100) | SÍ | — | |
| 4 | `pais` | varchar(10) | SÍ | — | |
| 5 | `edad_consultada` | integer | SÍ | — | |
| 6 | `consulta_para` | varchar(50) | SÍ | — | |
| 7 | `nombre_alumno` | varchar(100) | SÍ | — | |
| 8 | `nombre_contacto` | varchar(100) | SÍ | — | |
| 9 | `preferencia_modalidad` | varchar(20) | SÍ | — | |
| 10 | `es_alumno_anterior` | boolean | SÍ | — | |
| 11 | `curso_anterior_detalle` | text | SÍ | — | |
| 12 | `notas` | text | SÍ | — | |
| 13 | `source` | varchar(200) | SÍ | 'manual' | |
| 14 | `created_at` | timestamptz | NO | now() | |
| 15 | `updated_at` | timestamptz | NO | now() | |

**Registros:** 20,613 | **Tamaño:** 3.2 MB | **RLS:** Sí  
**Índices:** PK, `idx_person_profile_consulta` (consulta_para), `idx_person_profile_localidad` (localidad), `idx_person_profile_modalidad` (preferencia_modalidad), `idx_person_profile_provincia` (provincia)

---

### core_person_tags

Relación persona↔etiqueta normalizada con trazabilidad de origen y confianza.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | nextval(seq) | **PK** |
| 2 | `person_id` | bigint | NO | — | **FK** → core_persons(id) |
| 3 | `tag_id` | bigint | NO | — | **FK** → core_tags(id) |
| 4 | `source` | varchar(50) | NO | 'manual' | |
| 5 | `confidence` | float8 | SÍ | 1.0 | |
| 6 | `created_at` | timestamptz | NO | now() | |

**Registros:** 16,782 | **Tamaño:** 3.3 MB | **RLS:** Sí  
**Índices:** PK, **UNIQUE** (person_id, tag_id), `idx_person_tags_person`, `idx_person_tags_tag`, `idx_person_tags_source`

---

### core_personbyinterest

Relación M:N original persona↔interés (Django). Precursora de `core_person_tags`.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `interest_id` | bigint | NO | — | **FK** → core_interests(id) |
| 3 | `person_id` | bigint | NO | — | **FK** → core_persons(id) |

**Registros:** 8,873 | **Tamaño:** 992 KB | **RLS:** No  
**Índices:** PK, idx on `interest_id`, idx on `person_id`

---

### contactos

Importación directa de agenda de WhatsApp. Tabla externa a Django (sin id serial, PK es num_tel).

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `cod_pais` | varchar(4) | SÍ | — | |
| 2 | `nom_pais` | varchar(4) | SÍ | — | |
| 3 | `num_tel` | varchar(20) | NO | — | **PK** |
| 4 | `tel_form` | varchar(20) | SÍ | — | |
| 5 | `es_contacto` | boolean | SÍ | false | |
| 6 | `nom_agendado` | varchar(100) | SÍ | — | |
| 7 | `nom_publico` | varchar(150) | SÍ | — | |
| 8 | `es_negocio` | boolean | SÍ | false | |
| 9 | `es_admin` | boolean | SÍ | false | |
| 10 | `etiquetas` | text | SÍ | — | |
| 11 | `fecha_carga` | date | SÍ | CURRENT_DATE | |
| 12 | `tel_carga` | varchar(30) | SÍ | — | |

**Registros:** 13,845 | **Tamaño:** 2.2 MB | **RLS:** No  
**Índices:** `contactos_pkey` (num_tel)

---

## 2. Conversaciones y Mensajes

### core_conversations

Agrupa mensajes por par (canal empresa, canal persona). Una conversación permanece abierta mientras `end` sea NULL.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `result` | text | SÍ | — | |
| 3 | `start` | timestamptz | NO | — | |
| 4 | `end` | timestamptz | SÍ | — | |
| 5 | `company_com_channel_id` | bigint | NO | — | **FK** → core_companycomchannels(id) |
| 6 | `person_com_channel_id` | bigint | NO | — | **FK** → core_personcomchannels(id) |
| 7 | `respondent_id` | bigint | SÍ | — | **FK** → core_respondentcache(id) |

**Registros:** 22,423 | **Tamaño:** 3.2 MB | **RLS:** No  
**Índices:** PK, idx on `company_com_channel_id`, idx on `person_com_channel_id`, idx on `respondent_id`

---

### core_interactions

Cada mensaje individual (entrante o saliente), con estado de entrega, media, y metadatos de auditoría.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `provider_message_id` | varchar(255) | NO | — | |
| 3 | `text` | text | SÍ | — | |
| 4 | `timestamp` | timestamptz | NO | — | |
| 5 | `sender` | varchar(50) | NO | — | |
| 6 | `conversation_id` | bigint | SÍ | — | **FK** → core_conversations(id) |
| 7 | `person_id` | bigint | SÍ | — | **FK** → core_persons(id) |
| 8 | `respondent_id` | bigint | SÍ | — | **FK** → core_respondentcache(id) |
| 9 | `audit_user_id` | integer | SÍ | — | **FK** → auth_user(id) |
| 10 | `status` | integer | NO | — | |
| 11 | `media_id` | bigint | SÍ | — | **FK** → core_media(id) |
| 12 | `local_timestamp` | timestamptz | NO | — | |
| 13 | `respond` | integer | SÍ | — | |
| 14 | `postponed` | boolean | NO | — | |

**Registros:** 80,782 | **Tamaño:** 34 MB | **RLS:** No  
**Índices:** PK, idx on `conversation_id`, idx on `person_id`, idx on `respondent_id`, idx on `audit_user_id`, idx on `media_id`

---

### core_media

Archivos adjuntos (imágenes, videos, audios, documentos) referenciados desde interacciones.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `content` | varchar(100) | NO | — | |
| 3 | `mimetype` | varchar(100) | NO | — | |
| 4 | `name` | varchar(255) | NO | — | |

**Registros:** 7,366 | **Tamaño:** 984 KB | **RLS:** No  
**Índices:** PK

---

### core_aiinteractions

Sugerencia de respuesta generada por IA para una conversación. Vincula con el log detallado y la interacción final enviada.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `text` | text | NO | — | |
| 3 | `media` | varchar(100) | NO | — | |
| 4 | `acepted` | boolean | NO | — | |
| 5 | `conversation_id` | bigint | SÍ | — | **FK** → core_conversations(id) |
| 6 | `final_interaction_id` | bigint | SÍ | — | **FK** → core_interactions(id) |
| 7 | `timestamp` | timestamptz | NO | — | |
| 8 | `log_entry_id` | bigint | SÍ | — | **FK UNIQUE** → core_aiinteractionlog(id) |
| 9 | `failed` | boolean | NO | — | |

**Registros:** 20,615 | **Tamaño:** 6.9 MB | **RLS:** No  
**Índices:** PK, **UNIQUE** on `log_entry_id`, idx on `conversation_id`, idx on `final_interaction_id`

---

### core_aiinteractionlog

Registro inmutable de cada request/response a la IA, incluyendo prompt completo, texto sugerido vs. texto final, y feedback del operador.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `final_text` | text | NO | — | |
| 3 | `final_media` | varchar(100) | SÍ | — | |
| 4 | `ai_text` | text | NO | — | |
| 5 | `edited_by_human` | boolean | NO | — | |
| 6 | `rating` | integer | SÍ | — | |
| 7 | `feedback` | text | SÍ | — | |
| 8 | `prompt` | text | NO | — | |
| 9 | `request` | text | NO | — | |
| 10 | `ai_media` | varchar(100) | SÍ | — | |
| 11 | `ai_model` | varchar(100) | NO | — | |
| 12 | `ai_provider` | varchar(100) | NO | — | |

**Registros:** 22,981 | **Tamaño:** 572 MB (14 MB datos + 558 MB TOAST) | **RLS:** No  
**Índices:** PK

---

## 3. Etiquetas e Intereses

### core_tags

Catálogo normalizado de etiquetas con tipificación. Agregada post-migración para reemplazar el sistema de `core_interests`.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | nextval(seq) | **PK** |
| 2 | `name` | varchar(200) | NO | — | |
| 3 | `tag_type` | varchar(50) | NO | 'curso_interes' | |
| 4 | `course_id` | bigint | SÍ | — | **FK** → core_courses(id) |
| 5 | `modality` | varchar(20) | SÍ | — | |
| 6 | `description` | text | SÍ | — | |
| 7 | `is_active` | boolean | NO | true | |
| 8 | `created_at` | timestamptz | NO | now() | |

**Registros:** 31 | **Tamaño:** 64 KB | **RLS:** Sí  
**Índices:** PK, `idx_core_tags_type` (tag_type), `idx_core_tags_course` (course_id)

---

### core_interests

Catálogo original de intereses/etiquetas de Django. Más desestructurado que `core_tags`.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `name` | varchar(255) | NO | — | |
| 3 | `description` | text | SÍ | — | |

**Registros:** 36 | **Tamaño:** 32 KB | **RLS:** No  
**Índices:** PK

---

### core_lead_inquiry

Consultas comerciales con seguimiento de estado. Diseñada pero vacía en producción.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | nextval(seq) | **PK** |
| 2 | `person_id` | bigint | NO | — | **FK** → core_persons(id) |
| 3 | `course_id` | bigint | SÍ | — | **FK** → core_courses(id) |
| 4 | `channel` | varchar(50) | SÍ | — | |
| 5 | `inquiry_date` | timestamptz | NO | now() | |
| 6 | `edad_alumno` | integer | SÍ | — | |
| 7 | `es_para_si_mismo` | boolean | SÍ | — | |
| 8 | `modalidad_preferida` | varchar(20) | SÍ | — | |
| 9 | `status` | varchar(50) | NO | 'nueva' | |
| 10 | `conversation_id` | bigint | SÍ | — | **FK** → core_conversations(id) |
| 11 | `notas` | text | SÍ | — | |
| 12 | `created_at` | timestamptz | NO | now() | |

**Registros:** 0 | **Tamaño:** 48 KB | **RLS:** Sí  
**Índices:** PK, `idx_lead_inquiry_person`, `idx_lead_inquiry_course`, `idx_lead_inquiry_status`, `idx_lead_inquiry_date`

---

## 4. Cursos

### core_courses

Catálogo de cursos ofrecidos por IITA.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `name` | varchar(100) | NO | — | |
| 3 | `modality` | varchar(10) | NO | — | |
| 4 | `additional_information` | text | SÍ | — | |
| 5 | `duration` | varchar(1000) | NO | — | |
| 6 | `bill_type` | varchar(17) | NO | — | |
| 7 | `quota_price` | integer | SÍ | — | |
| 8 | `registration_price` | integer | SÍ | — | |

**Registros:** 19 | **Tamaño:** 72 KB | **RLS:** No

---

### core_courseedition

Ediciones específicas de un curso en una sucursal, con horarios y estado.

| # | Columna | Tipo | Nullable | Default | Constraint |
|---|---------|------|----------|---------|------------|
| 1 | `id` | bigint | NO | — | **PK** |
| 2 | `status` | varchar(11) | NO | — | |
| 3 | `class_day` | varchar(9) | NO | — | |
| 4 | `start_time` | time | SÍ | — | |
| 5 | `end_time` | time | SÍ | — | |
| 6 | `min_age` | integer | SÍ | — | |
| 7 | `max_age` | integer | SÍ | — | |
| 8 | `tentative_start_date` | date | SÍ | — | |
| 9 | `extra_info` | text | SÍ | — | |
| 10 | `branch_id` | bigint | SÍ | — | **FK** → core_branches(id) |
| 11 | `course_id` | bigint | SÍ | — | **FK** → core_courses(id) |

**Registros:** 43 | **Tamaño:** 104 KB | **RLS:** No

---

## 5. IA y Respondents

### core_aiproviders

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `name` | varchar(255) | NO | — |
| 3 | `endpoint_url` | varchar(200) | SÍ | — |
| 4 | `encrypted_api_key` | varchar(1000) | SÍ | — |
| 5 | `max_resquests_per_day` | integer | NO | — |
| 6 | `max_resquests_per_minute` | integer | NO | — |
| 7 | `max_resquests_per_month` | integer | NO | — |

**Registros:** 1 | **RLS:** No

### core_aimodels

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `name` | varchar(255) | NO | — |
| 3 | `provider_id` | bigint | NO | — (FK → core_aiproviders) |

**Registros:** 5 | **RLS:** No

### core_aiparams

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `name` | varchar(100) | NO | — (UNIQUE) |
| 3 | `type` | varchar(6) | NO | — |

**Registros:** 2 | **RLS:** No

### core_values

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `number_val` | float8 | SÍ | — |
| 3 | `string_val` | text | SÍ | — |
| 4 | `chance` | float8 | NO | — |
| 5 | `param_id` | bigint | NO | — (FK → core_aiparams) |
| 6 | `model_val_id` | bigint | SÍ | — (FK → core_aimodels) |

**Registros:** 2 | **RLS:** No

### core_respondentcache

Cache de respondent (set de Values seleccionado para una sesión IA).

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |

**Registros:** 22,424 | **RLS:** No  
> Solo tiene PK; la relación con Values es vía tabla puente.

### core_respondentcache_values

M2M entre RespondentCache y Values.

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `respondentcache_id` | bigint | NO | — (FK → core_respondentcache) |
| 3 | `values_id` | bigint | NO | — (FK → core_values) |

**Registros:** 44,843 | **RLS:** No  
**UNIQUE:** (respondentcache_id, values_id)

### core_airequestlog

Log de requests HTTP a proveedores IA.

| # | Columna | Tipo | Nullable | Default |
|---|---------|------|----------|---------|
| 1 | `id` | bigint | NO | — |
| 2 | `timestamp` | timestamptz | NO | — |
| 3 | `response` | text | SÍ | — |
| 4 | `provider_id` | bigint | SÍ | — (FK → core_aiproviders) |

**Registros:** 19,116 | **Tamaño:** 22 MB | **RLS:** No

---

## 6. Empresa y Configuración

### core_companies

| Columna | Tipo | Nullable |
|---------|------|----------|
| `id` | bigint | NO (PK) |
| `name` | varchar(255) | NO |
| `industry` | varchar(255) | NO |

**Registros:** 1 (IITA)

### core_branches

| Columna | Tipo | Nullable |
|---------|------|----------|
| `id` | bigint | NO (PK) |
| `location` | varchar(255) | NO |
| `name` | varchar(255) | NO |
| `client_support` | boolean | NO |

**Registros:** 2 (IITA Centro, IITA San Lorenzo Chico)

### core_chatproviders

| Columna | Tipo | Nullable |
|---------|------|----------|
| `id` | bigint | NO (PK) |
| `name` | varchar(255) | NO |
| `endpoint_url` | varchar(200) | NO |

**Registros:** 4 (whatsapp, whatsapp_maytapi, whatsapp_coexistence, whatsapp_coexistence - SanLorenzo)

### core_companycomchannels

| Columna | Tipo | Nullable |
|---------|------|----------|
| `id` | bigint | NO (PK) |
| `group_address` | varchar(255) | SÍ |
| `address` | varchar(255) | NO |
| `branch_id` | bigint | SÍ (FK → core_branches) |
| `provider_id` | bigint | SÍ (FK → core_chatproviders) |
| `name` | varchar(255) | NO |

**Registros:** 9

### core_empleado, core_settings, core_companiesdata, core_limit, core_rol

Tablas auxiliares con 0-1 registros cada una. Ver diccionario de datos para detalles.

---

## 7. Django Admin (infraestructura)

| Tabla | Registros | Descripción |
|-------|-----------|-------------|
| auth_user | 7 | Usuarios del panel admin |
| auth_permission | 144 | Permisos Django |
| auth_user_user_permissions | 87 | Asignación usuario↔permiso |
| auth_group | 0 | Grupos (vacío) |
| auth_group_permissions | 0 | Permisos de grupo (vacío) |
| auth_user_groups | 0 | Asignación usuario↔grupo (vacío) |
| django_admin_log | 136 | Log de acciones admin |
| django_content_type | 36 | Tipos de contenido Django |
| django_migrations | 98 | Historial de migraciones |
| django_session | 234 | Sesiones activas/expiradas |
| django_site | 1 | Configuración de sitio |

---

## Tablas con RLS habilitado

| Tabla | RLS |
|-------|-----|
| core_tags | ✅ |
| core_person_tags | ✅ |
| core_person_profile | ✅ |
| core_person_channels | ✅ |
| core_lead_inquiry | ✅ |

> Todas las tablas normalizadas (agregadas post-migración) tienen RLS habilitado. Las tablas originales de Django no lo tienen.
