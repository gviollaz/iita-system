# Convenciones de Nombres

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Base de Datos (PostgreSQL)

### Tablas

- **Formato:** `snake_case` en plural
- **Ejemplos:** `persons`, `conversations`, `interactions`, `course_editions`

### Columnas

- **Formato:** `snake_case`
- **Clave primaria:** `id` (bigint, auto-increment)
- **Clave foranea:** `tabla_singular_id`
  - Ejemplo: `person_id`, `conversation_id`, `course_edition_id`
- **Timestamps:** `created_at`, `updated_at`
- **Booleanos:** prefijo `is_` o `has_` (ej: `is_active`, `has_media`)
- **Campos de estado:** `status`

### Indices

- **Formato:** `idx_tabla_columnas`
- **Ejemplos:**
  - `idx_interactions_external_ref`
  - `idx_person_conversation_person_id`
  - `idx_conversations_last_activity_at`
- **Indices unicos:** `uq_tabla_columnas`

### Triggers

- **Formato:** `trg_accion_descriptiva`
- **La funcion asociada:** mismo nombre sin prefijo `trg_`
- **Ejemplos:**
  - Trigger: `trg_prevent_echo_interaction` / Funcion: `prevent_echo_interaction()`
  - Trigger: `trg_prevent_duplicate_conversation` / Funcion: `prevent_duplicate_conversation()`
  - Trigger: `trg_update_last_activity` / Funcion: `update_conversation_last_activity()`

### Funciones SQL

- **Formato:** `verbo_sustantivo` en `snake_case`
- **Verbos comunes:**
  - `get_` para consultas (ej: `get_chat_detail`, `get_conversations`)
  - `find_or_create_` para upserts (ej: `find_or_create_conversation`)
  - `approve_` para acciones de aprobacion (ej: `approve_ai_response`)
  - `search_` para busquedas (ej: `search_persons`)
  - `process_` para logica de negocio (ej: `process_incoming_message`)
  - `prevent_` para validaciones (ej: `prevent_duplicate_conversation`)

### Enums

- **Formato:** `contexto_campo`
- **Valores:** `snake_case` en minusculas
- **Ejemplos:**
  - Estados de interaccion: `new`, `preprocessed`, `processed`, `pending_delivery`, `sending`, `send`
  - Estados de IA: `pending`, `approved`, `conflictive`
  - Direccion: `incoming`, `outgoing`
  - Estados de edicion: `Enrolling`, `Pending`, `In_Progress`, `Conclude`, `Disabled`

### Constraints

- **CHECK:** `chk_descripcion` (ej: `chk_single_direction`)
- **UNIQUE:** `uq_tabla_columnas` (ej: `uq_person_conversation_external`)
- **FOREIGN KEY:** generados automaticamente por Supabase

---

## Frontend (React)

### Componentes

- **Formato:** `PascalCase`
- **Archivo:** mismo nombre que el componente
- **Ejemplos:** `Dashboard.jsx`, `Conversations.jsx`, `GenericTable.jsx`, `Lightbox.jsx`

### Hooks

- **Formato:** `use{Descripcion}` en camelCase
- **Ejemplos:** `useIsMobile`, `useConversations`, `usePersons`

### Variables CSS

- **Formato:** `--kebab-case`
- **Prefijo por contexto:**
  - Colores: `--color-*` (ej: `--color-bg`, `--color-text`, `--color-accent`)
  - Espaciado: `--space-*` (ej: `--space-sm`, `--space-md`)
  - Bordes: `--border-*` (ej: `--border-radius`)

### Funciones y variables JS

- **Formato:** `camelCase`
- **Constantes:** `UPPER_SNAKE_CASE`
- **Ejemplos:** `formatDate()`, `unwrap()`, `API_URL`

### Path Alias

- `@/` = `src/`

---

## Archivos y Documentacion

### Documentos

- **Formato:** `UPPER-KEBAB-CASE.md`
- **Ejemplos:** `BUGS-CONOCIDOS.md`, `FEATURES.md`, `ROADMAP.md`, `NAMING-CONVENTIONS.md`

### ADRs (Architecture Decision Records)

- **Formato:** `NNNN-descripcion-breve.md`
- **Ejemplos:** `0001-supabase-como-backend.md`, `0002-makecom-como-orquestador.md`

### Scripts

- **Formato:** `kebab-case`
- **Ejemplos:** `make-sync.py`, `export-data.sh`

### Migraciones (Supabase)

- **Formato:** `snake_case` descriptivo
- **Ejemplos:** `fix_media_url_in_get_chat_detail`, `prevent_echo_interaction`, `analytics_rpcs`

---

## Desviaciones Historicas

La siguiente tabla documenta nombres que no siguen las convenciones actuales pero se mantienen por compatibilidad. No corregir sin migracion planificada.

| Nombre actual | Convencion esperada | Tipo | Razon |
|---------------|---------------------|------|-------|
| `id_person_conversation` | `person_conversation_id` | Columna FK en `interactions` | Creado antes de definir la convencion de FKs. Usado en multiples funciones y flujos de Make.com. |
| `descrption` | `description` | Columna en `courses` | Typo original. Usado en Edge Functions y frontend. |
| `confictive` | `conflictive` | Valor de enum en `ai_interaction.evaluation` | Typo original. Usado en funciones SQL, Make.com y frontend. |
| `content_dir` | `content_url` o `storage_path` | Columna en `medias` | Nombre confuso: almacena base64 o URL, no un directorio. |
| `branche_users` | `branch_users` | Nombre de tabla | Typo: "branche" en vez de "branch". Tabla vacia, se puede renombrar al implementar RBAC. |
| `send` | `sent` | Valor de enum en status de interacciones | Error gramatical. Ultimo estado del ciclo: `new` -> ... -> `send`. |
| `person_soft_data` | `person_attributes` o `person_metadata` | Nombre de tabla | "soft data" es un termino interno no estandar. |
| `system_conversation` | `conversation_channels` | Nombre de tabla | "system" es ambiguo; la tabla vincula conversaciones con canales. |
| `external_ref` | `external_id` | Columna en varias tablas | "ref" es ambiguo; contiene el ID externo del mensaje en el proveedor. |
