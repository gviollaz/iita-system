# Documentación Arquitectónica del Sistema de Mensajería IITA

**Versión:** 1.0  
**Fecha de auditoría:** 19 de febrero de 2026  
**Elaborado por:** Auditoría arquitectónica de sistema  
**Fuentes analizadas:**
- Snapshot de Make.com: `2026-02-19_produccion` (118 escenarios)
- Base de datos Supabase: `iita-base` (proyecto `cpkzzzwncpbzexpesock`)
- Repositorio Frontend: `IITA-Proyectos/iitacrm` (React + Vite)
- Repositorio Make Sync: `gviollaz/iita-make-scenarios`

---

## Tabla de Contenidos

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura de Alto Nivel](#2-arquitectura-de-alto-nivel)
3. [Capa de Datos: Supabase](#3-capa-de-datos-supabase)
4. [Capa de Automatización: Make.com](#4-capa-de-automatización-makecom)
5. [Capa de API: Edge Functions](#5-capa-de-api-edge-functions)
6. [Capa de Presentación: Frontend CRM](#6-capa-de-presentación-frontend-crm)
7. [Flujos de Datos Verificados](#7-flujos-de-datos-verificados)
8. [Inventario de Escenarios Activos](#8-inventario-de-escenarios-activos)
9. [Puntos Fuertes](#9-puntos-fuertes)
10. [Debilidades y Riesgos](#10-debilidades-y-riesgos)
11. [Posibles Bugs Detectados](#11-posibles-bugs-detectados)
12. [Temas a Confirmar](#12-temas-a-confirmar)

---

## 1. Visión General del Sistema

### 1.1 Propósito

El sistema es una **plataforma de mensajería multicanal con generación de respuestas por IA** para IITA (Instituto de Informática y Tecnología Aplicada) y su Fundación Innovar. Opera en dos sedes (Salta y San Lorenzo Chico) atendiendo consultas de potenciales alumnos a través de WhatsApp, Instagram y Messenger.

### 1.2 Filosofía de Diseño

El sistema sigue una arquitectura **event-driven con pipeline de procesamiento por etapas**. Cada mensaje entrante recorre un pipeline lineal (entrada → registro → preprocesamiento → generación IA → aprobación → envío) donde cada etapa es desencadenada por eventos en la base de datos (triggers) que disparan webhooks hacia escenarios de Make.com.

La filosofía fundamental es la de un **CRM de mensajería con IA asistida**: los mensajes de clientes generan respuestas automáticas por IA, pero estas respuestas requieren aprobación humana antes de ser enviadas. El sistema no es un chatbot autónomo sino un asistente que propone respuestas para revisión.

### 1.3 Dimensiones del Sistema

| Métrica | Valor |
|---------|-------|
| Personas registradas | 25,223 |
| Conversaciones | 24,621 |
| Interacciones (mensajes) | 102,431 |
| Respuestas IA generadas | 12,281 |
| Contactos registrados | 20,959 |
| Canales activos | 11 |
| Sedes | 2 (Salta, San Lorenzo Chico) |
| Proveedores de canal | 5 (WhatsApp, Instagram, Messenger, WhatsApp Cloud API, Email) |
| Escenarios Make.com | 118 (43 activos, 75 legacy/inactivos) |
| Datos enriquecidos (person_soft_data) | 75,211 registros |

---

## 2. Arquitectura de Alto Nivel

### 2.1 Diagrama Conceptual de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                   CANALES EXTERNOS                          │
│  WhatsApp(x5)  │  Instagram(x2)  │  Messenger(x2)  │ Email │
└───────┬─────────────────┬──────────────────┬────────────────┘
        │ Webhooks         │                  │
┌───────▼─────────────────▼──────────────────▼────────────────┐
│              MAKE.COM (Orquestación)                        │
│  1_entrada → 2_procesamiento → 3_preprocesamiento          │
│  → 4_generacion → 6_aprobacion → 7_envio                   │
└───────┬──────────────────────────────────────┬──────────────┘
        │ HTTP / SQL                            │ Webhooks
┌───────▼──────────────────────────────────────▼──────────────┐
│              SUPABASE (Persistencia + Eventos)              │
│  PostgreSQL + Triggers + Edge Functions + Storage           │
└───────┬─────────────────────────────────────────────────────┘
        │ REST API
┌───────▼─────────────────────────────────────────────────────┐
│              FRONTEND CRM (React + Vite)                    │
│  Dashboard │ Conversaciones │ Personas │ Cursos             │
│  Desplegado en Vercel                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Patrón de Comunicación

El sistema utiliza un patrón híbrido:

- **Make.com ↔ Supabase**: Conexión directa PostgreSQL y via Edge Functions (HTTP)
- **Supabase → Make.com**: Triggers de base de datos que disparan webhooks (`supabase_functions.http_request`)
- **Frontend → Supabase**: A través de Edge Function `crm-api` (REST) y funciones RPC directas
- **Frontend → Make.com**: Indirectamente, a través del Edge Function `crm-api` que llama a webhooks de aprobación

### 2.3 Modelo de Ejecución de los Triggers

**Verificado en la base de datos.** Los siguientes triggers en la tabla `interactions` conectan la base de datos con Make.com:

| Trigger | Evento | Webhook destino | Propósito |
|---------|--------|-----------------|-----------|
| `Pre-Processing` | INSERT | `afn3xvc6...` | Preprocesamiento de media |
| `New_interaction` | INSERT | `av6s4jtj...` | Registro en Google Sheets |
| `Respond Generation - Prod` | UPDATE | `h0ls5cnm...` | Generación de respuesta IA |
| `New_pending_delivery_and_send` | INSERT + UPDATE | `b4dwbegs...` | Despacho de mensajes |
| `trg_prevent_dup_conversation` | INSERT en `system_conversation` | (función local) | Prevención de duplicados |

**Observación importante:** Estos triggers se disparan para TODAS las inserciones/actualizaciones en `interactions`, independientemente de si el mensaje es entrante o saliente, o de su estado. El filtrado de qué acción tomar se realiza dentro de los escenarios de Make.com, no en los triggers.

---

## 3. Capa de Datos: Supabase

### 3.1 Modelo de Datos Principal (Dominio de Mensajería)

#### 3.1.1 Entidades Centrales

**`persons`** (25,223 registros): Persona física que contacta a IITA. Campos verificados: `id`, `first_name`, `last_name`, `email`, `birth_date`, `location_address`, `country`, `state_province`, `national_id`, `legal_guardian_id` (auto-referencia para menores), `creation_datetime`.

**`conversations`** (24,621 registros): Unidad lógica de conversación. Solo contiene `id` y `start_date`. Es una entidad puente que conecta personas con canales a través de dos tablas intermedias.

**`person_conversation`** (24,621 registros): Vincula persona a conversación. Campos: `id_person`, `id_conversation`, `address` (dirección del contacto en el canal, ej: número de WhatsApp), `contact_username` (username de red social).

**`system_conversation`** (24,621 registros): Vincula canal a conversación. Campos: `id_channel`, `id_conversation`. Existe una relación 1:1:1 entre `conversations`, `person_conversation` y `system_conversation` (verificado: las tres tablas tienen exactamente 24,621 registros).

**`interactions`** (102,431 registros): Cada mensaje individual. La dirección del mensaje se determina por cuál FK tiene valor: `id_person_conversation` (entrante) o `id_system_conversation` (saliente). Tiene un enum de status: `new` → `preprocessed` → `processed` → `pending_delivery` → `sending` → `send`. Campos: `text`, `time_stamp`, `status`, `external_ref`, `ad_id`.

**Distribución verificada de estados de interacciones:**
- `preprocessed`: 56,131 (54.8%) — mensajes entrantes procesados
- `send`: 46,189 (45.1%) — mensajes enviados
- `pending_delivery`: 110 (0.1%) — en cola de envío
- `new`: 0 — se procesan inmediatamente
- `processed`: 0 — estado intermedio no observado en datos actuales

#### 3.1.2 Entidades de Canal

**`channel_providers`** (5 registros): Tipos de plataforma. Valores: `whatsapp` (id=1), `instagram` (id=2), `messenger` (id=3), `whatsapp cloud api` (id=4), `email` (id=5).

**`channels`** (11 registros): Canal específico (combina proveedor + sede). Cada canal tiene `address` (identificador en la plataforma), `branch_id` (sede) y `id_channel_provider`. Ejemplo: "IITA San Lorenzo" es WhatsApp (provider=1), branch=2, address=5493876844174.

**`branches`** (2 registros): Sedes físicas. Salta (id=1) y San Lorenzo Chico (id=2), cada una con dirección y link de Google Maps.

#### 3.1.3 Entidades de IA

**`ai_interaction`** (12,281 registros): Respuesta generada por IA. Vincula la interacción entrante (`associated_interaction_id`) con la respuesta generada como interacción saliente (`generated_interaction_id`). Campos: `response` (texto de la respuesta), `system_prompt` (prompt utilizado), `evaluation` (enum: `pending`, `approved`, `confictive`).

**Distribución verificada de evaluaciones IA:**
- `NULL`: 6,755 (55%) — sin evaluación asignada
- `approved`: 4,051 (33%) — aprobadas
- `pending`: 1,462 (12%) — pendientes de aprobación
- `confictive`: 0 — ninguna marcada como conflictiva

**Nota:** El valor del enum es `confictive` (sin la segunda "l"), esto es un typo en el schema pero es funcional.

#### 3.1.4 Entidades de Enriquecimiento

**`person_contacts`** (20,959 registros): Contactos alternativos de la persona. Vincula `person_id` con `channel_provider_id` y `contact_value` (número, username, email).

**`person_soft_data`** (75,211 registros): Datos flexibles extraídos por IA de las conversaciones. Estructura key-value: `person_id`, `data_name`, `data_content`, `datetime`, `disabled`, `editable`. Top categorías verificadas: `pais` (21,194), `provincia` (17,426), `localidad` (16,184), `tag_curso_interes` (15,726), `difusion_recibida` (811), `consulta_para` (617), `pref_modalidad` (533).

#### 3.1.5 Entidades de Media

**`medias`** (53 registros): Archivos multimedia. Campos: `name`, `content_dir` (path en storage), `type`, `description`, `disabled`.

**`interaction_medias`** (53 registros): Tabla puente N:N entre interacciones y medias.

#### 3.1.6 Entidades de Publicidad

**`ads`** (17 registros): Anuncios de plataformas publicitarias. Vinculados a `ad_providers` y opcionalmente a `courses`. Cuando un mensaje entrante viene de un anuncio, se registra el `ad_id` en la interacción.

**`ad_providers`** (1 registro): Proveedores de publicidad.

### 3.2 Modelo de Datos Secundario (Dominio Educativo)

**`courses`** (40 registros): Cursos ofrecidos por IITA. Campos: `name`, `bill_type` (ONLY_REGISTRATION / QUOTA), `registration_price`, `quota_price`, `duration`, `description`, `playlist_name`, `disable`.

**`course_editions`** (98 registros): Ediciones (instancias) de un curso con horarios, capacidad, rango de edad, modalidad (PRESENTIAL/VIRTUAL), fecha tentativa, y sede.

**`course_edition_schedule`** (101 registros): Horarios por día de la semana para cada edición.

**`course_members`** (0 registros): Inscripciones de personas a ediciones. **Tabla vacía** — el módulo de inscripciones no está en uso.

**`course_tickets`**, **`payment_tickets`**, **`payments`**, **`payments_logs`** (todos con 0 registros): Sistema de facturación y pagos. **Completamente vacío** — no implementado.

### 3.3 Modelo de Datos Terciario (Dominio de Usuarios/Auth)

**`users`**, **`roles`**, **`permissions`**, **`role_permissions`**, **`branche_users`** (todos con 0 registros): Sistema RBAC para el CRM. **Completamente vacío** — el CRM actual opera sin autenticación.

### 3.4 Funciones RPC (Verificadas)

| Función | Uso | Invocada desde |
|---------|-----|----------------|
| `process_incoming_message` | Registra mensaje entrante, crea persona/conversación si no existen | Edge Function `crm-api` + Make.com |
| `process_outgoing_message` | Registra mensaje saliente en conversación existente | Edge Function `crm-api` |
| `process_echo_message` | Registra mensaje echo (enviado desde teléfono) | Edge Function `crm-api` |
| `approve_interaction` | Aprueba respuesta IA y dispara webhook de envío (usa `pg_net`) | RPC directo desde frontend |
| `find_or_create_conversation` | Busca o crea conversación por address + channel | Make.com (legacy) |
| `get_conversations` | Lista conversaciones con filtros (proveedor, canal, sede, estado, búsqueda, fechas) | Edge Function `crm-api` |
| `get_crm_stats` | Estadísticas generales del CRM | Edge Function `crm-api` |
| `get_msgs_per_day` | Mensajes por día para gráficos | Edge Function `crm-api` |
| `get_volume_by_channel` | Volumen por canal | Edge Function `crm-api` |
| `get_volume_by_provider` | Volumen por proveedor | Edge Function `crm-api` |
| `get_channel_analysis` | Análisis detallado por canal con filtros temporales | Edge Function `crm-api` |
| `get_top_leads` | Leads más activos | Edge Function `crm-api` |
| `get_unanswered_conversations` | Conversaciones sin respuesta | Edge Function `crm-api` |
| `get_person_detail` | Detalle de persona | Edge Function `crm-api` |
| `get_person_full_profile` | Perfil completo de persona | Edge Function `crm-api` |
| `get_persons_enriched` | Lista de personas con filtros enriquecidos | Edge Function `crm-api` |
| `get_persons_filter_options` | Opciones disponibles para filtros | Edge Function `crm-api` |
| `search_persons` | Búsqueda de personas | Edge Function `crm-api` |
| `prevent_duplicate_conversation` | Trigger function — previene conversaciones duplicadas | Trigger en `system_conversation` |

**Observación:** Existen DOS versiones de `process_incoming_message` (sobrecarga): una con 6 parámetros y otra con 7 (agrega `p_username`). La versión con username incluye además verificación de duplicados por `external_ref` y actualización de `contact_username`.

### 3.5 RLS (Row Level Security)

Todas las tablas tienen RLS habilitado (`rls_enabled: true`). Sin embargo, dado que la tabla `users` está vacía y no hay sistema de autenticación implementado, las policies de RLS probablemente permiten acceso total vía `service_role_key` (usado por la Edge Function).

### 3.6 Extensiones Verificadas

- **pg_net** (v0.19.5): Utilizado por `approve_interaction` para hacer HTTP POST a webhooks de Make.com directamente desde PostgreSQL.

---

## 4. Capa de Automatización: Make.com

### 4.1 Estructura del Pipeline

El pipeline está organizado en 7 etapas numeradas (la etapa 5 está reservada/vacía):

```
ETAPA 1: ENTRADA (9 escenarios) — Recepción de webhooks de plataformas
    ↓ Llama subscenario
ETAPA 2: PROCESAMIENTO (7 escenarios) — Creación de interacciones y conversaciones
    ↓ Trigger de DB
ETAPA 3: PREPROCESAMIENTO (2 escenarios) — Análisis de media
    ↓ Trigger de DB (cambia status → preprocessed)
ETAPA 4: GENERACIÓN (2 escenarios) — Generación de respuesta IA
    ↓ Escribe ai_interaction
ETAPA 5: (RESERVADA - Evaluación futura)
    ↓
ETAPA 6: APROBACIÓN (4 escenarios) — Registro en Google Sheets + aprobación desde frontend
    ↓ Trigger de DB o webhook desde CRM
ETAPA 7: ENVÍO (20 escenarios) — Despacho y envío por canal
```

### 4.2 Etapa 1: Entrada — Análisis Detallado

Cada canal tiene su propio escenario de entrada que actúa como adaptador/normalizador. Se verificaron los siguientes patrones en el blueprint de `[INPUT] San Lorenzo Chico - WhatsApp Coexistence` (ID 4161348):

**Módulo trigger:** `whatsapp-business-cloud:watchEvents2` — recibe eventos del webhook de WhatsApp Business Cloud API.

**Router principal con dos ramas:**
1. **Mensaje de cliente** (condición: `messages` existe):
   - **Sin media:** Extrae `text.body`, `contacts[].wa_id`, `contacts[].profile.name`, `messages[].id` → Llama subscenario `Create new interaction` (SCN_3730125) con `is_user=true`, `status=new`
   - **Con media:** Primero descarga el archivo media vía `getMedia`, extrae caption, luego llama al mismo subscenario con datos de media (`media_data` en base64, `media_extension`, `media_external_id`)

2. **Status de entrega** (condición: `statuses` existe y `status=delivered`):
   - Registra como mensaje saliente (echo) con `is_user=false`, texto fijo "Respondido desde telefono", sin esperar resultado del subscenario

**Datos normalizados pasados al subscenario:**
- `provider_name`: Tomado de `messaging_product`
- `channel_address`: `metadata.display_phone_number`
- `person_address`: `contacts[].wa_id`
- `person_name`: `contacts[].profile.name`
- `external_ref`: `messages[].id`
- `text`: `messages[].text.body` o caption de media
- `is_user`: true para mensajes, false para echos
- `status`: "new"

**Canales de entrada activos verificados:**
| ID | Nombre | Plataforma | Estado |
|----|--------|-----------|--------|
| 4161348 | San Lorenzo Chico - WhatsApp Coexistence | WhatsApp Cloud API | ✅ Activo |
| 4097069 | IITA Chatbot - WhatsApp Cloud API | WhatsApp Cloud API | ✅ Activo |
| 4067591 | IITA Salta - Instagram | Instagram | ✅ Activo |
| 4096655 | IITA San Lorenzo - Instagram | Instagram | ✅ Activo |
| 4068107 | IITA Salta/San Lorenzo - Messenger | Messenger | ✅ Activo |
| 4077066 | IITA test - WhatsApp Cloud API | WhatsApp Cloud API | ✅ Activo (test) |
| 4114223 | chatbot test (dev) | Test | ✅ Activo (dev) |
| 3794481 | IITA 3D - WhatsApp Coexistence | WhatsApp | ❌ Inactivo |
| 4115159 | IITA 3D (Dev) | WhatsApp | ❌ Inactivo |

### 4.3 Etapa 2: Procesamiento

Los subscenarios centrales son:

**`Create new interaction`** (SCN_3730125, activo): Recibe datos normalizados de la etapa 1. Basándose en `is_user` y `provider_name`, resuelve el canal correcto (`channel_id`), luego llama a la Edge Function o función RPC para registrar el mensaje en la base de datos. Retorna `id_interaction` e `id_person_conversation`.

**`Create new conversation`** (SCN_3730131, activo): Escenario complementario para creación de conversaciones.

**`Save media into bucket`** (SCN_3729890, activo): Guarda archivos multimedia en Supabase Storage.

### 4.4 Etapa 3: Preprocesamiento (Media Analysis)

**`[Prepross] Media Analisis - prod`** (ID 4132732, activo): Disparado por trigger de DB al insertar una interacción. Analiza contenido multimedia (imágenes, audio, video) utilizando servicios de IA para transcripción y descripción. Actualiza el status de la interacción a `preprocessed`.

**Segundo escenario** (ID 4105815, activo): Versión anterior o complementaria del mismo flujo.

### 4.5 Etapa 4: Generación de Respuesta IA

**`[RG] Generate ai response - prod`** (ID 4132827, activo): Disparado por trigger de DB cuando una interacción pasa a estado `preprocessed`. Genera una respuesta utilizando OpenAI/Claude. Crea un registro en `ai_interaction` con la respuesta propuesta, el system prompt utilizado, y evaluation=`pending`. No envía la respuesta directamente.

### 4.6 Etapa 6: Aprobación

**`Create Google Sheets records`** (ID 3502129, activo): Registra cada nueva interacción en una hoja de Google Sheets para seguimiento manual.

**`Generar interacciones desde Google Sheet (Dev)`** (ID 4106306, activo): Flujo inverso — lee aprobaciones desde Google Sheets y genera interacciones de respuesta.

### 4.7 Etapa 7: Envío

**`IITA - Approve & Dispatch (Producción)`** (ID 4168577, activo): Recibe aprobaciones vía webhook desde el CRM. Proceso verificado en blueprint:
1. Recibe payload con `response`, `provider_name`, `person_address`, `channel_address`, `created_at`, `id_ai_interaction`
2. **Verifica deadline de 24h** (condición: `now < addHours(created_at, 24)`) — si pasaron más de 24h, no envía (esto es por restricciones de WhatsApp)
3. Crea interacción con status `pending_delivery` vía subscenario `Create new interaction`
4. Si es respuesta de IA (`id_ai_interaction` existe), actualiza `ai_interaction` marcando `evaluation=approved` y vinculando `generated_interaction_id`

**`IITA - Message dispatcher (Producción)`** (ID 4124755, activo): Recibe interacciones con status `pending_delivery` (vía trigger de DB) y las rutea al escenario de envío correcto según el proveedor del canal.

**`Sending messages (Producción)`** (ID 4125079, activo): Escenario orquestador que coordina el envío real.

**Escenarios [OUT] por canal** (12 escenarios activos): Cada combinación canal+sede tiene su propio escenario de envío (ej: `[OUT] Whatsapp ~ San Lorenzo Chico (Producción)`, `[OUT] Instagram ~ Salta (Producción)`, etc.). Estos escenarios usan las APIs nativas de cada plataforma para enviar el mensaje.

---

## 5. Capa de API: Edge Functions

### 5.1 Edge Function `crm-api` (v17)

Es el **único punto de entrada API** para el frontend. No tiene JWT verification (`verify_jwt: false`), utiliza `SUPABASE_SERVICE_ROLE_KEY` internamente.

**Endpoints verificados en el código:**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `dispatch_approved` | POST | Envía respuesta aprobada a Make.com vía webhook hardcoded |
| `incoming_message` | POST | Procesa mensaje entrante (llama RPC `process_incoming_message`) |
| `outgoing_message` | POST | Procesa mensaje saliente (llama RPC `process_outgoing_message`) |
| `conversations` | POST | Lista conversaciones con filtros (llama RPC `get_conversations`) |
| `chat` | POST | Obtiene historial completo de una conversación con mensajes, IA, ads y media |
| `channels` | POST | Lista canales con sus branches y providers |
| `branches` | POST | Lista sedes |
| `stats` | POST | Estadísticas generales |
| `msgs_per_day` | POST | Mensajes por día |
| `volume_by_channel` | POST | Volumen por canal |
| `volume_by_provider` | POST | Volumen por proveedor |
| `channel_analysis` | POST | Análisis de canal con filtros temporales |
| `top_leads` | POST | Leads más activos |
| `unanswered` | POST | Conversaciones sin respuesta |
| `person_detail` | POST | Detalle de persona |
| `person_full` | POST | Perfil completo de persona |
| `persons_enriched` | POST | Lista enriquecida con filtros |
| `persons_filter_options` | POST | Opciones de filtro |
| `search_persons` | POST | Búsqueda de personas |
| `person_conversations` | POST | Conversaciones de una persona |
| `persons_list` | POST | Lista paginada de personas con canales |
| `update_person` | POST | Actualiza datos de persona |
| `send_to_person` | POST | Envía mensaje a persona desde CRM |
| (CRUD genérico) | POST | `action`: select/insert/update/delete/soft_delete en cualquier tabla |

**Webhook de aprobación hardcoded:** `https://hook.us2.make.com/gebhak7g2shvpfp4dr3ht8ay5oak48nc`

### 5.2 Edge Function `courses-crud` (v1)

Función dedicada a CRUD de cursos. Separada de crm-api.

### 5.3 Edge Function `create-test-user` (v2)

Función utilitaria para crear usuarios de prueba.

---

## 6. Capa de Presentación: Frontend CRM

### 6.1 Stack Tecnológico

- **Framework:** React (sin React Router — navegación por estado con tabs)
- **Build:** Vite
- **Estilo:** CSS-in-JS (inline styles) + variables CSS custom + media queries
- **Hosting:** Vercel
- **Comunicación:** fetch directo contra Edge Function `crm-api` y RPC de Supabase

### 6.2 Estructura de Navegación

Aplicación SPA con 4 secciones principales controladas por estado local (`section`):

1. **Dashboard** (`📊`): Estadísticas generales, gráficos de volumen, leads activos, mensajes sin respuesta
2. **Conversaciones** (`💬`): Lista de conversaciones con filtros, vista de chat con historial, panel de persona, aprobación de respuestas IA
3. **Personas** (`👥`): Lista paginada con filtros (curso de interés, provincia, país, teléfono, email), detalle de persona, envío de mensajes
4. **Cursos** (`📚`): CRUD de cursos y ediciones

### 6.3 Módulo `api.js`

Dos funciones principales:
- `post(body)`: Envía request POST a la Edge Function `crm-api`. Incluye normalización de errores.
- `rpc(fnName, params)`: Llama directamente a funciones RPC de Supabase vía REST API con anon key.
- `unwrap(d)`: Utilidad para normalizar respuestas anidadas.

### 6.4 Estado de Responsividad

Utiliza hook custom `useIsMobile()` (breakpoint en 768px):
- **App.jsx:** ✅ Responsive (nav con emojis en mobile)
- **Dashboard:** ✅ Responsive (grids adaptativos)
- **Conversations:** ✅ Responsive (lista o chat, no ambos)
- **People:** ✅ Responsive (lista o detalle)
- **Courses:** ⚠️ Parcialmente responsive

### 6.5 Estado de Conexión

El App.jsx incluye un health check que hace POST a `/branches` cada 60 segundos y muestra indicador visual de conexión (verde/amarillo/rojo).

---

## 7. Flujos de Datos Verificados

### 7.1 Flujo: Mensaje Entrante (WhatsApp → DB → IA → Aprobación → Envío)

```
1. WhatsApp envía webhook a Make.com
2. Escenario [INPUT] normaliza datos y llama subscenario "Create new interaction"
3. Subscenario resuelve channel_id y llama Edge Function `incoming_message`
4. Edge Function llama RPC `process_incoming_message`:
   a. Busca persona por address en person_conversation, luego person_contacts
   b. Si no existe, crea persona + person_contacts
   c. Busca conversación existente (address + channel) con FOR UPDATE
   d. Si no existe, crea conversations + person_conversation + system_conversation
   e. Verifica duplicado por external_ref
   f. Busca ad_id si hay referencia de anuncio
   g. Inserta interacción con status='new'
5. Trigger "Pre-Processing" se dispara → webhook a Make.com
6. Escenario Media Analysis analiza media, actualiza status a 'preprocessed'
7. Trigger "Respond Generation" se dispara → webhook a Make.com
8. Escenario Generate AI Response genera respuesta, crea ai_interaction con evaluation='pending'
9. Trigger "New_interaction" se dispara → webhook a Make.com
10. Escenario Google Sheets registra la interacción
11. (PAUSA — Espera aprobación humana)
12. Operador revisa en CRM, aprueba:
    a. Frontend llama Edge Function `dispatch_approved`
    b. Edge Function envía payload a webhook de Make.com (Approve & Dispatch)
    c. Escenario verifica deadline 24h
    d. Crea interacción con status='pending_delivery' 
    e. Actualiza ai_interaction (evaluation='approved', generated_interaction_id)
13. Trigger "New_pending_delivery_and_send" se dispara → webhook a Make.com
14. Message Dispatcher rutea al escenario [OUT] correcto
15. Escenario [OUT] envía mensaje via API de la plataforma
```

### 7.2 Flujo: Mensaje Echo (Respuesta manual desde teléfono)

```
1. Operador responde desde WhatsApp Business directamente
2. Meta envía status event con delivered + recipient_id
3. Escenario [INPUT] detecta "statuses" con status "delivered"
4. Llama subscenario con is_user=false, texto "Respondido desde telefono"
5. Se registra como interacción saliente en system_conversation
```

### 7.3 Flujo: Aprobación desde CRM (Alternativa)

Existe un segundo mecanismo de aprobación verificado en la función RPC `approve_interaction`:

```
1. Frontend llama RPC `approve_interaction` con ai_interaction_id
2. Función verifica que evaluation='pending' y generated_interaction_id no es null
3. Actualiza evaluation='approved'
4. Actualiza interaction status a 'pending_delivery'
5. Hace HTTP POST a webhook de Make.com vía pg_net
```

**Nota:** Este es un camino paralelo al flujo `dispatch_approved` de la Edge Function. Hay DOS mecanismos de aprobación coexistiendo.

---

## 8. Inventario de Escenarios Activos

### 8.1 Producción (43 escenarios activos)

**Entrada (7 activos):**
- 4161348: San Lorenzo Chico - WhatsApp Coexistence
- 4097069: IITA Chatbot - WhatsApp Cloud API
- 4067591: IITA Salta - Instagram
- 4096655: IITA San Lorenzo - Instagram
- 4068107: IITA Salta/San Lorenzo - Messenger
- 4077066: IITA test - WhatsApp Cloud API
- 4114223: chatbot test (dev)

**Procesamiento (5 activos):**
- 3730125: Create new interaction
- 3730131: Create new conversation
- 3729890: Save media into bucket
- 4097260: Create new conversation (Dev)
- 4097381: Create new interaction (Dev)

**Preprocesamiento (2 activos):**
- 4105815: Media Analysis - prod
- 4132732: Media Analysis - prod (segundo)

**Generación (1 activo):**
- 4132827: Generate ai response - prod

**Aprobación (3 activos):**
- 3502129: Create Google Sheets records
- 4106306: Generar interacciones desde Google Sheet (Dev)

**Envío (20 activos):**
- 4168577: Approve & Dispatch (Producción)
- 4124755: Message dispatcher (Producción)
- 4125079: Sending messages (Producción)
- 12 escenarios [OUT] por canal (6 producción + 6 dev)
- 3759370: Message dispatcher (Dev)
- 4058936: Sending messages (Dev)

**Otros (5 activos):**
- 3671815: Find Branches Information
- 3522196: Flujo de Reuniones
- 3595321 + 3614175: Search available courses (x2)
- 3794184: Search courses edition info
- 3794086: Search courses info by name

### 8.2 Legacy/Inactivos (75 escenarios)

Incluyen versiones anteriores del pipeline, integraciones legacy con WhatsApp Coexistence (por número de teléfono), logs de mensajes, generadores de contenido para redes sociales, integraciones con Mercado Pago, Gmail, Google My Business, TikTok, y diversos tests/pruebas.

---

## 9. Puntos Fuertes

### 9.1 Arquitectura Event-Driven

El uso de triggers de PostgreSQL para desencadenar webhooks a Make.com es un patrón elegante que desacopla la escritura de datos de la orquestación de procesos. Permite que cualquier fuente que escriba en la tabla `interactions` (frontend, API, Make.com) active automáticamente el pipeline completo.

### 9.2 Normalización de Canales

El patrón de usar subscenarios compartidos (`Create new interaction`) con datos normalizados es acertado. Cada canal tiene su adaptador específico, pero convergen en un formato común. Esto facilita agregar nuevos canales sin modificar la lógica central.

### 9.3 Modelo de Datos Extensible

La tabla `person_soft_data` con su estructura key-value permite enriquecer personas con datos arbitrarios (intereses, ubicación, etc.) sin modificar el schema. Ya contiene 75K+ registros de enriquecimiento.

### 9.4 Prevención de Duplicados

Las funciones RPC incluyen verificación de duplicados por `external_ref` y locks (`FOR UPDATE`) para prevenir race conditions en la creación de conversaciones.

### 9.5 Control de Calidad Humano

El modelo de "IA propone, humano aprueba" es una decisión de diseño prudente para una institución educativa que necesita mantener calidad y tono en sus comunicaciones.

### 9.6 Versionado de Escenarios

La herramienta `make_sync.py` para exportar, versionar y corregir blueprints de Make.com es una buena práctica que permite auditoría y rollback.

---

## 10. Debilidades y Riesgos

### 10.1 Seguridad

**CRÍTICO — Edge Function sin autenticación:** La Edge Function `crm-api` tiene `verify_jwt: false` y acepta CORS de cualquier origen (`Access-Control-Allow-Origin: *`). Cualquier persona con la URL puede ejecutar queries SQL arbitrarias contra la base de datos (vía el CRUD genérico con actions `select/insert/update/delete`). Esto expone todos los datos personales de 25K+ personas.

**CRÍTICO — Webhook de aprobación hardcoded:** La URL del webhook de Make.com para aprobaciones está en el código fuente de la Edge Function. Si alguien la obtiene, puede enviar mensajes a cualquier contacto.

**CRÍTICO — Sistema de usuarios vacío:** Las tablas `users`, `roles`, `permissions` están vacías. No hay ningún control de acceso implementado.

### 10.2 Arquitectura

**Triggers "broadcast" sin filtro:** Los triggers en `interactions` se disparan para TODOS los INSERT/UPDATE, enviando webhooks a Make.com incluso para operaciones que no los necesitan. Esto genera tráfico innecesario y consume operaciones de Make.com. Los escenarios deben filtrar internamente.

**Duplicación de escenarios Dev/Prod:** Hay escenarios duplicados para Dev y Producción (ej: `Create new interaction` + `Create new interaction (Dev)`), ambos activos. No hay un mecanismo claro de feature flags o environment switching.

**Dos mecanismos de aprobación coexistentes:** La función RPC `approve_interaction` y el endpoint `dispatch_approved` de la Edge Function hacen cosas similares pero por caminos diferentes (la RPC usa `pg_net`, la Edge Function usa `fetch` directo a webhook). Esto puede generar inconsistencias.

### 10.3 Rendimiento

**N+1 en `persons_list`:** El endpoint `persons_list` de la Edge Function hace queries individuales por cada persona para obtener sus canales de contacto (loop de `person_conversation` + `system_conversation` por cada persona). Con 50 personas por página, esto genera ~150 queries adicionales.

**Sin paginación eficiente en conversaciones:** `get_conversations` usa `LIMIT/OFFSET`, que se degrada con offsets grandes en tablas de 100K+ registros.

### 10.4 Mantenibilidad

**118 escenarios en Make.com:** La complejidad del sistema de automatización es alta. Hay 75 escenarios legacy/inactivos que añaden ruido. No hay un mecanismo de limpieza o archivado.

**CSS inline en frontend:** Todo el estilado es con inline styles en JSX, lo que dificulta mantener consistencia visual y hacer cambios globales.

**Dos versiones de `process_incoming_message`:** La sobrecarga con 6 y 7 parámetros puede generar confusión sobre cuál se invoca (depende del nombre de los parámetros en la llamada RPC).

---

## 11. Posibles Bugs Detectados

### 11.1 Bug: Interacciones estancadas en `pending_delivery` (110 registros)

**Evidencia:** Existen 110 interacciones con status `pending_delivery` en la base de datos. Este status debería ser transitorio (se pasa a `sending` y luego a `send`). 110 registros estancados sugieren que el flujo de envío falló o no se completó para estos mensajes.

**Impacto:** Mensajes aprobados que nunca se enviaron.

### 11.2 Bug potencial: 6,755 AI interactions con evaluation NULL

**Evidencia:** El 55% de los registros en `ai_interaction` tienen `evaluation` en NULL (no `pending`, no `approved`, sino NULL literal). El enum define `pending`, `approved`, y `confictive` (sin NULL). Esto sugiere que hubo un periodo donde se creaban registros sin asignar evaluación, o que hay un bug en la generación.

**Impacto:** Estas respuestas IA no aparecerían en los filtros de "pendientes" del CRM.

### 11.3 Bug potencial: Echo con texto fijo "Respondido desde telefono"

**Evidencia:** En el blueprint de WhatsApp Coexistence, cuando se detecta un delivery status, se registra con texto literal "Respondido desde telefono" en lugar del contenido real del mensaje. Los delivery status de WhatsApp no incluyen el texto del mensaje original.

**Impacto:** El CRM muestra "Respondido desde telefono" en lugar del contenido real de las respuestas manuales. Esto afecta la comprensibilidad del historial.

### 11.4 Bug potencial: Dos escenarios de Media Analysis activos simultáneamente

**Evidencia:** IDs 4105815 y 4132732 tienen el mismo nombre (`[Prepross] Media Analisis - prod`) y ambos están activos. Si el trigger dispara un webhook genérico, ambos podrían ejecutarse para el mismo mensaje.

**Impacto:** Posible doble procesamiento de media o conflicto de actualizaciones de status.

### 11.5 Bug potencial: Deadline de 24h calculado incorrectamente para diferentes timezones

**Evidencia:** En el Approve & Dispatch, la condición es `now < addHours(created_at, 24)`. El `created_at` viene del payload del CRM (basado en `time_stamp` de la interacción, que usa `NOW()` de PostgreSQL en UTC). Si Make.com usa una timezone diferente para `now`, el cálculo podría estar desfasado.

**Impacto:** Mensajes podrían ser rechazados (o aceptados) incorrectamente por la ventana de 24h de WhatsApp.

### 11.6 Bug potencial: CRUD genérico sin validación de tabla

**Evidencia:** La Edge Function `crm-api` acepta `action: "select"/"insert"/"update"/"delete"` con `table` arbitrario. No hay whitelist de tablas permitidas ni validación de campos.

**Impacto:** Cualquier tabla puede ser leída, modificada o eliminada sin restricción. Combinado con la falta de autenticación (10.1), esto es un riesgo severo.

### 11.7 Bug potencial: Webhook URL diferente en approve_interaction vs dispatch_approved

**Evidencia:** La función RPC `approve_interaction` usa webhook `fwb5rjoebapd5s7r8r3xatc7kfw6k4s0` (como default), mientras que la Edge Function `dispatch_approved` usa webhook `gebhak7g2shvpfp4dr3ht8ay5oak48nc`. Son webhooks DIFERENTES apuntando potencialmente a escenarios diferentes.

**Impacto:** Dependiendo de qué camino de aprobación se use, el mensaje podría ir a escenarios distintos con comportamientos distintos.

### 11.8 Bug potencial: `status` "new" nunca observado en datos

**Evidencia:** A pesar de que las interacciones se insertan con `status='new'`, hay 0 registros con este status. Todos están en `preprocessed` o `send`. Esto sugiere que el trigger de Pre-Processing se ejecuta casi instantáneamente y cambia el status, o que hay un camino de código que salta el status `new`.

**Observación:** Este comportamiento podría ser correcto si el pipeline es muy rápido, pero vale la pena verificar.

---

## 12. Temas a Confirmar

Los siguientes puntos no pudieron ser verificados completamente con los datos disponibles y requieren confirmación del equipo de desarrollo:

### 12.1 Flujo de Media Analysis
- **Pregunta:** ¿Los dos escenarios de Media Analysis (4105815 y 4132732) procesan mensajes diferentes o hay overlap? ¿El trigger de Pre-Processing apunta a cuál de los dos?
- **Contexto:** El trigger envía webhook a `afn3xvc6...`. Necesito ver qué escenario tiene ese webhook como trigger.

### 12.2 Mecanismo de aprobación activo
- **Pregunta:** ¿El CRM actualmente usa `dispatch_approved` (Edge Function) o `approve_interaction` (RPC) para aprobar mensajes? ¿O ambos?
- **Contexto:** Existen dos caminos con webhooks diferentes. El frontend parece tener ambos disponibles.

### 12.3 Escenarios Dev activos en producción
- **Pregunta:** ¿Los escenarios marcados como "(Dev)" que están activos (ej: 4097260, 4097381, 4106306) están procesando datos reales? ¿Hay un mecanismo para diferenciar tráfico dev de producción?
- **Contexto:** No se observó separación de ambientes en la configuración de webhooks.

### 12.4 Google Sheets en el flujo de aprobación
- **Pregunta:** ¿El flujo de aprobación via Google Sheets (`Create Google Sheets records` + `Generar interacciones desde Google Sheet`) sigue activo y en uso, o fue reemplazado por el CRM?
- **Contexto:** Ambos escenarios están activos pero podrían ser legacy.

### 12.5 Canal IITA 3D
- **Pregunta:** ¿El canal IITA 3D (WhatsApp, address 5493875809318) debería estar activo? Su escenario de entrada está inactivo pero el canal sigue registrado en la DB (id=2) y hay escenarios [OUT] activos para él.

### 12.6 Módulo de cursos y pagos
- **Pregunta:** ¿El módulo de cursos (40 cursos, 98 ediciones) está en uso activo? Las tablas de inscripciones (`course_members`) y pagos (`payments`, `payment_tickets`) están completamente vacías.

### 12.7 person_soft_data
- **Pregunta:** ¿Quién/qué escribe los datos de `person_soft_data`? No se encontró referencia en los escenarios analizados ni en la Edge Function. ¿Es la IA durante la generación de respuesta quien extrae y persiste estos datos?

### 12.8 Campo `descrption` en tabla channels
- **Pregunta:** El campo se llama `descrption` (sin la 'i'). ¿Se renombra o se mantiene por compatibilidad?

---

*Fin del documento. Este documento fue elaborado a partir de análisis directo de código fuente, blueprints de Make.com, datos de base de datos y estructura de funciones. Toda la información fue verificada contra las fuentes primarias excepto los puntos listados en la Sección 12.*
