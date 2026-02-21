# Sistema de Mensajería IITA — Documentación Técnica
## Pipeline Completo: Etapas 1 a 5 + Propuesta de Etapa 3.5 (Evaluación)
### Verificado contra blueprints de Make.com — Febrero 2026

---

## ÍNDICE

1. [Visión general del pipeline](#1-visión-general)
2. [Base de datos (Supabase)](#2-base-de-datos)
3. [ETAPA 1 — Flujos de entrada](#3-etapa-1)
4. [ETAPA 2 — Subscenario "Create new interaction"](#4-etapa-2)
5. [ETAPA 2 (sub) — Subscenario "Create new conversation"](#5-create-conversation)
6. [ETAPA 2.5 — Preprocesamiento: Media Analysis](#6-etapa-25)
7. [ETAPA 3 — Generación de respuesta AI](#7-etapa-3)
8. [ETAPA 3.5 (PROPUESTA) — Evaluación y filtrado post-generación](#8-etapa-35)
9. [ETAPA 4 — Aprobación vía Google Sheets](#9-etapa-4)
10. [ETAPA 5 — Envío de mensajes](#10-etapa-5)
11. [Recorrido completo de un mensaje](#11-recorrido-completo)
12. [Inventario de bugs y problemas](#12-bugs)
13. [Recomendaciones de mejora](#13-recomendaciones)
14. [Inventario de escenarios](#14-inventario)

---

## 1. VISIÓN GENERAL

El sistema recibe mensajes de leads (personas interesadas en cursos de IITA) a través de Instagram, WhatsApp y Messenger, los almacena en Supabase, analiza media adjunta con IA, genera respuestas automáticas, y las envía previa aprobación manual.

```
PIPELINE COMPLETO — 5 ETAPAS
═══════════════════════════════

 ETAPA 1               ETAPA 2                     ETAPA 2.5              ETAPA 3             ETAPA 4            ETAPA 5
 Flujos de entrada     Subscenario central         Preprocesamiento       Generación AI       Aprobación         Envío
 (1 por canal)         "Create new interaction"    Media Analysis         + Registro          Google Sheets      Dispatcher
 ─────────────────     ──────────────────────      ────────────────       ──────────────      ──────────────     ────────

 [Instagram Salta]─┐
 [Instagram SL]   ─┤
 [WA Cloud API]   ─┤   ¿Existe interacción?        Supabase webhook       Supabase webhook    Webhook watch      Supabase webhook
 [WA Coex 3D]     ─┼─→ (idempotencia)          ──→ dispara cuando    ──→ dispara cuando  ──→ columna H     ──→ dispara cuando
 [WA Coex SL]     ─┤   ¿Existe conversación?       status = 'new'         status =            = "true"           status =
 [Messenger]      ─┤   Crear persona si nueva       │                      'preprocessed'      │                  'pending_delivery'
 [WA test]        ─┘   Crear conversación si nueva  ├─ Imagen → GPT-5.2    │                   │                  │
                       Crear interacción             ├─ Audio → Whisper    ├─ Sleep 60s        ├─ Deadline        ├─ Dispatcher
                       Guardar media en Storage      ├─ PDF → GPT-5.2     ├─ Lee historial      check (24h)        ├─ Provider
                       │                             └─ Otro → marca      ├─ Agente AI        ├─ Crea nueva         routing
                       └─ Retorna:                      como no analizable│  genera resp         interacción      ├─ Channel
                          id_interaction                │                  ├─ INSERT              status=             routing
                          id_person_conversation        └─ status →       │  ai_interaction      'pending_        └─ API call
                                                          'preprocessed'  │  eval='pending'       delivery'          (WA/IG/FB)
                                                                          └─ Google Sheet       └─ UPDATE Sheet      │
                                                                             (por sede)                              └─ status →
                                                                                                                       'send'
```

### Etapas documentadas en este archivo

Este documento cubre el **pipeline completo** de las 5 etapas del sistema de mensajería, desde la recepción del mensaje hasta el envío de la respuesta. Incluye además una **propuesta arquitectónica** para una nueva Etapa 3.5 de evaluación/filtrado automático.

---

## 2. BASE DE DATOS (Supabase)

**Proyecto:** cpkzzzwncpbzexpesock (Producción)
**Región:** us-east-1

### 2.1 Tablas y volúmenes

| Tabla | Registros | Función |
|-------|----------|---------|
| **interactions** | 102,230 | Cada mensaje individual (entrante o saliente) |
| **person_soft_data** | 75,219 | Datos blandos de personas (intereses, etc.) |
| **conversations** | 25,877 | Hilo de conversación entre persona y canal |
| **person_conversation** | 25,877 | Vínculo persona → conversación (con address) |
| **system_conversation** | 25,866 | Vínculo canal → conversación |
| **persons** | 25,556 | Personas/leads únicos |
| **person_contacts** | 21,096 | Datos de contacto formales |
| **ai_interaction** | 11,920 | Respuestas generadas por IA |
| **interaction_medias** | 44 | Relación interacción ↔ media |
| **medias** | 44 | Metadata de archivos + descripción AI |
| **ads** | 17 | Anuncios vinculados a cursos |
| **channels** | 11 | Canales configurados |
| **channel_providers** | 5 | Proveedores (instagram, whatsapp, etc.) |
| **branches** | 2 | Sedes (Salta, San Lorenzo Chico) |

### 2.2 Modelo de datos — Cómo se relacionan las tablas

```
                                    ┌──────────────────┐
                                    │    persons       │
                                    │ id, first_name,  │
                                    │ last_name, email │
                                    └────────┬─────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                          ▼                  ▼                  ▼
                 person_contacts    person_soft_data    person_conversation
                 (channel_provider, (intereses, etc.)   id_person
                  phone, etc.)                          id_conversation ──┐
                                                        address ←────── │ ← tel/IG ID del lead
                                                                        │
                                                                        ▼
         system_conversation ──────────────────────────→ conversations
         id_channel                                      id (solo start_date)
         id_conversation ──────────────────────────────→ ↑
                │
                ▼
           channels ──→ channel_providers ──→ branches
           (address)    (name: instagram,     (Salta, SL)
                         whatsapp, etc.)

         INTERACCIONES:
         ══════════════
         interactions
         ├── id_person_conversation → entrante (del lead) ← SOLO UNO de estos dos tiene valor
         ├── id_system_conversation → saliente (del sistema)
         ├── text, external_ref, time_stamp, status, ad_id
         │
         ├──→ interaction_medias ──→ medias
         │                           content_dir (path en Storage)
         │                           description (análisis AI)
         │                           type (extensión)
         │
         └──→ ai_interaction
              associated_interaction_id → interacción entrante
              generated_interaction_id  → interacción saliente creada
              response (texto generado)
              evaluation (pending/approved/modified/confictive)
```

### 2.3 Dirección del mensaje

La dirección se determina por cuál FK tiene valor:

| Campo con valor | Campo NULL | Dirección |
|----------------|-----------|-----------|
| `id_person_conversation` | `id_system_conversation` | **Entrante** (del lead) |
| `id_system_conversation` | `id_person_conversation` | **Saliente** (del sistema) |

### 2.4 Lifecycle de status

```
new → preprocessed → processed → pending_delivery → sending → send
 │         │                          │                         │
 │         │                          │                         └─ Mensaje enviado exitosamente
 │         │                          └─ Aprobado, esperando envío
 │         └─ Media analizada, listo para generación AI
 └─ Recién llegado, pendiente análisis media
```

**Distribución actual:** 54.7% preprocessed, 45.2% send, 0.1% pending_delivery, 0.04% new

### 2.5 Canales configurados

| ID | Nombre | Provider | Address | Sede |
|----|--------|----------|---------|------|
| 1 | IITA Administracion | whatsapp | 5493872550001 | Salta |
| 2 | IITA 3D | whatsapp | 5493875809318 | Salta |
| 3 | IITA Tesoreria | whatsapp | 5493872550003 | Salta |
| 4 | IITA San Lorenzo | whatsapp | 5493876844174 | San Lorenzo Chico |
| 5 | IITA Cursos | whatsapp | 5493875809351 | Salta |
| 6 | IITA Salta - Instagram | instagram | 17841404168256335 | Salta |
| 7 | IITA San Lorenzo chico - Instagram | instagram | 17841455198100771 | San Lorenzo Chico |
| 8 | IITA Salta - Messenger | messenger | 296373163870909 | Salta |
| 9 | IITA San Lorenzo Chico - Messenger | messenger | 106307535517599 | San Lorenzo Chico |
| 10 | Chatbot (Cloud API) | whatsapp cloud api | 111869345312688 | Salta |
| 11 | IITA Cursos Email | email | cursosiita@gmail.com | Salta |

---

## 3. ETAPA 1 — FLUJOS DE ENTRADA

La carpeta "1. Flujos de entrada - Produccion" contiene 9 escenarios. Cada flujo recibe webhooks o eventos de una plataforma específica, normaliza los datos, y llama al subscenario central "Create new interaction" (SCN_3730125).

### 3.1 Contrato de llamada al subscenario central

Todos los flujos llaman a SCN_3730125 con estos campos. Este es el "contrato" que define la interfaz entre la Etapa 1 y la Etapa 2:

| Campo | Tipo | ¿Requerido? | Descripción | Quién lo puebla |
|-------|------|-------------|-------------|-----------------|
| `external_ref` | text | No* | ID del mensaje en la plataforma (wamid.xxx, mid.xxx) | Todos deberían, pero hay bugs |
| `provider_name` | text | **Sí** | "instagram" / "whatsapp" / "whatsapp cloud api" / "messenger" | Todos |
| `channel_address` | text | **Sí** | ID/número de la cuenta propia de IITA | Todos |
| `person_address` | text | No | ID/número del contacto externo | Todos |
| `text` | text | No | Contenido textual del mensaje | Todos |
| `is_user` | boolean | No (default: true) | true=entrante, false=saliente | Instagram y WA Coex |
| `person_name` | text | No | Nombre del contacto | Solo WA (Cloud API y Coex) |
| `ad_id` | text | No | ID del anuncio de Meta Ads | ⚠️ Ninguno lo captura hoy |
| `media_data` | text | No | Archivo en base64 | Flujos con media |
| `media_extension` | text | No | Extensión (jpg, mp4, ogg, etc.) | Flujos con media |
| `media_external_id` | text | No | Nombre/ID del archivo en la plataforma | Flujos con media |
| `status` | select | No | "new" / "preprocessed" / etc. | Varía (ver inconsistencias) |

*`external_ref` debería ser requerido pero no lo es en la spec, causando serios problemas de datos.

### 3.2 Flujos analizados en detalle

#### A) Instagram IITA Salta
- **Consumo:** 2,039 operaciones, 654.7 MB de datos transferidos
- **Trigger:** Webhook custom (verificación + procesamiento)
- **Flujo:** Router verificación/mensaje → Filtros (excluye reads, edits, story_mentions, reels) → Sub-router entrante (normal) / saliente (is_echo=true) → Download File → base64() → CallSubscenario
- **Particularidades:**
  - Descarga TODA la media y la convierte a base64 → 654 MB de consumo
  - Captura mensajes salientes vía is_echo (los marca como is_user=false)
  - `status` enviado: "new"
  - `person_name`: ❌ no lo captura (Instagram no lo envía en el webhook, requeriría Graph API)
  - `ad_id`: ❌ no lo captura (a pesar de que Instagram sí envía referral.ad_id)
  - Wait for subscenario: true (síncrono)
  - Error handlers: ninguno

#### B) WhatsApp Cloud API - Chatbot
- **Consumo:** 384 operaciones, 719.3 KB
- **Trigger:** Webhook custom con verificación de token
- **Flujo:** Router verificación/mensaje → Filter (entry.id=111869345312688, filtra solo este número) → Router media/sin media → Set Variable (caption según tipo) → Download File (con API key auth bearer token de Meta) → CallSubscenario
- **Particularidades:**
  - Mucho más eficiente en consumo (no convierte imágenes a base64 innecesariamente)
  - `status` enviado: "new"
  - `person_name`: ✅ captura correctamente
  - `ad_id`: ❌ no lo captura
  - Wait for subscenario: true (síncrono)
  - **🔴 BUG P0: Caption hardcodeado** — el módulo 8 (Set Variable) usa `image.caption` fijo en vez de la variable calculada en módulo 6, perdiendo captions de video y documentos

#### C) WhatsApp Coexistence - San Lorenzo Chico
- **Consumo:** 0 operaciones (nuevo, sin actividad aún)
- **Trigger:** Módulo nativo `watchEvents2` (WhatsApp Coexistence)
- **Flujo:** Router messages/statuses → Router media/sin media → Get Media nativo → Set Variable (caption según tipo) → CallSubscenario (fire-and-forget)
- **Particularidades:**
  - Captura mensajes salientes via "statuses" (pero sin contenido textual real)
  - `status` enviado: ❌ **no envía status** → el campo queda NULL/vacío en la DB
  - `person_name`: ✅ captura correctamente
  - `ad_id`: ❌ no lo captura
  - Wait for subscenario: **false** (fire-and-forget, no espera resultado)
  - **🔴 BUG P0: mediaId corrupto** — sticker.id se concatena fuera del if(), corrompiendo el ID para todos los tipos de media
  - **🔴 BUG P0: Caption usa video.id** — guarda el ID del video en vez del caption del video

### 3.3 Tabla comparativa de inconsistencias

| Característica | Instagram | WA Cloud API | WA Coexistence |
|---------------|-----------|-------------|----------------|
| person_name | ❌ no disponible | ✅ captura | ✅ captura |
| ad_id | ❌ no captura | ❌ no captura | ❌ no captura |
| status enviado | ✅ "new" | ✅ "new" | ❌ no envía |
| Mensajes salientes | ✅ is_echo | ❌ no los captura | ✅ statuses (sin contenido) |
| Wait for subscenario | ✅ true | ✅ true | ❌ false |
| Error handlers | ❌ ninguno | ❌ ninguno | ❌ ninguno |
| Consumo de media | 🔴 Alto (base64 todo) | ✅ Eficiente | ✅ Eficiente |

### 3.4 ¿Qué pasa si el status no se envía?

Cuando WA Coexistence no envía `status`, el subscenario crea la interacción con status NULL o vacío. El flujo de Media Analysis (Etapa 2.5) filtra por `status = 'new'`, así que **estas interacciones nunca se procesan** y quedan atrapadas sin análisis de media ni transición a `preprocessed`. Esto es un problema silencioso que podría explicar mensajes "perdidos".

---

## 4. ETAPA 2 — SUBSCENARIO "CREATE NEW INTERACTION" (SCN_3730125)

Este es el **corazón del sistema**. Recibe los datos normalizados de cualquier canal y orquesta la creación/búsqueda de persona, conversación e interacción.

### 4.1 Interfaz

**Input spec** (confirmado del blueprint):

```
external_ref     text      (opt)  "Referencia externa. Es el id del sistema de origen"
provider_name    text      (req)  "nombre del channel_provider"
channel_address  text      (req)  "address del canal (Numero de telefono, id de la cuenta, etc.)"
person_address   text      (opt)  "address de la persona que envio/recibio el mensaje"
text             text      (opt)  "Texto del mensaje"
is_user          boolean   (opt, default: true)  "Es usuario o no"
person_name      text      (opt)  "Nombre de la persona. Si se debe registrar nueva persona se usa esto"
ad_id            text      (opt)  "Identificador del anuncio"
media_external_id text     (opt)  "id externo de la media"
media_data       text      (opt)  "media adjuntada a la interaccion" (base64)
media_extension  text      (opt)  "Extensión del archivo de media"
status           select    (opt)  "new" | "preprocessed" | "processed" | "pending_delivery" | "sending" | "send"
```

**Output spec:**
```
id_interaction          text    ID de la interacción creada
id_person_conversation  text    ID de la person_conversation (solo para entrantes)
```

### 4.2 Diagrama de flujo detallado

```
ENTRADA: var.input (todos los campos de arriba)
    │
    ▼
[Mod 2] "Get Interaction"
    │   postgres:SelectFromTable → interactions
    │   WHERE external_ref = var.input.external_ref
    │   LIMIT 1
    │   continueWhenNoRes = true (si no encuentra, sigue con bundle vacío)
    │
    ▼
[Mod 30] "Get person/system Conversation"
    │   FILTER: "La interaccion ya existe"
    │   → Solo pasa si 2.external_ref NO EXISTE (es decir, no encontró nada = es nueva)
    │
    │   SQL: SELECT pc.id as person_conversation_id, sc.id as system_conversation_id
    │        FROM channel_providers cp
    │        JOIN channels c ON c.id_channel_provider = cp.id
    │        JOIN system_conversation sc ON sc.id_channel = c.id
    │        JOIN person_conversation pc ON pc.id_conversation = sc.id_conversation
    │        WHERE cp.name = '{provider_name}'
    │          AND c.address = '{channel_address}'
    │          AND pc.address = '{person_address}'
    │
    │   continueWhenNoRes = true (si no encuentra conversación, sigue con campos vacíos)
    │
    ▼
[Mod 8] ROUTER: "¿Exists conversation?"
    │
    │
    ╔═══════════════════════════════════════════════════════════════╗
    ║  RUTA 1: NO existe conversación                              ║
    ║  Condición: 30.person_conversation_id NO EXISTE              ║
    ╚═══════════════════════════════════════════════════════════════╝
    │
    ▼
[Mod 9] "Crear persona"
    │   INSERT INTO persons (first_name, creation_datetime)
    │   VALUES (var.input.person_name, now())
    │   → Todos los demás campos vacíos (email, last_name, country, etc.)
    │   → returnRows = true → devuelve rows[].id
    │   ⚠️ NO verifica si la persona ya existe por otro canal
    │
    ▼
[Mod 7] CALL SUBSCENARIO "Create new conversation" (SCN_3730131)
    │   INPUT: person_id = 9.rows[].id
    │          provider_name, person_address, channel_address
    │   OUTPUT: id_system_conversation, id_person_conversation
    │   shouldWaitForExecutionEnd = true
    │
    ▼
[Mod 10] ROUTER: "¿Is user?"
    │
    ├──── is_user = TRUE ─────────────────────────────────────────────┐
    │                                                                  │
    │   [Mod 11] INSERT interactions                                   │
    │     id_person_conversation = 7.id_person_conversation            │
    │     id_system_conversation = "" (vacío)                          │
    │     text, external_ref, ad_id, status, time_stamp=now()          │
    │     returnRows = true → rows[].id                                │
    │     │                                                            │
    │     ▼                                                            │
    │   [Mod 44] ROUTER (con else):                                    │
    │     │                                                            │
    │     ├── var.input.media_data EXISTE:                              │
    │     │   [Mod 45] CALL "Save media into bucket" (SCN_3729890)     │
    │     │     INPUT: binary_data = media_data                        │
    │     │            media_name = "interaction_medias/                │
    │     │                         interaction_media_{11.rows[].id}    │
    │     │                         (1)"                               │
    │     │            media_extension, media_external_id               │
    │     │     OUTPUT: media_id                                       │
    │     │   [Mod 48] INSERT interaction_medias                       │
    │     │     interaction_id = 11.rows[].id                          │
    │     │     media_id = 45.media_id                                 │
    │     │   [Mod 46] RETURN (id_interaction, id_person_conversation) │
    │     │                                                            │
    │     └── else (sin media):                                        │
    │         [Mod 33] RETURN (id_interaction, id_person_conversation) │
    │                                                                  │
    └──── is_user = FALSE ────────────────────────────────────────────┐
                                                                       │
        [Mod 13] INSERT interactions                                   │
          id_system_conversation = 7.id_system_conversation            │
          id_person_conversation = "" (vacío)                          │
          text, external_ref, status, time_stamp=now()                 │
          ad_id = "" (vacío para salientes)                            │
        [Mod 37] RETURN (id_interaction)                               │
          ⚠️ No retorna id_person_conversation para salientes          │
    │
    │
    ╔═══════════════════════════════════════════════════════════════╗
    ║  RUTA 2: SÍ existe conversación                              ║
    ║  Condición: 30.person_conversation_id EXISTE                 ║
    ╚═══════════════════════════════════════════════════════════════╝
    │
    ▼
[Mod 14] ROUTER: "¿Is user?"
    │
    ├──── is_user = TRUE ─────────────────────────────────────────────┐
    │                                                                  │
    │   [Mod 15] INSERT interactions                                   │
    │     id_person_conversation = 30.person_conversation_id           │
    │     (usa la conversación encontrada en Mod 30)                   │
    │     text, external_ref, ad_id, status, time_stamp=now()          │
    │     │                                                            │
    │     ▼                                                            │
    │   [Mod 42] ROUTER (con else):                                    │
    │     │                                                            │
    │     ├── media_data EXISTE:                                       │
    │     │   [Mod 41] CALL "Save media into bucket" (SCN_3729890)     │
    │     │     media_name = "interaction_medias/                       │
    │     │                   interaction_media_{15.rows[].id} (1)"    │
    │     │   [Mod 47] INSERT interaction_medias                       │
    │     │   [Mod 35] RETURN (id_interaction, id_person_conversation) │
    │     │                                                            │
    │     └── else (sin media):                                        │
    │         [Mod 43] RETURN (id_interaction, id_person_conversation) │
    │                                                                  │
    └──── is_user = FALSE ────────────────────────────────────────────┐
                                                                       │
        [Mod 16] INSERT interactions                                   │
          id_system_conversation = 30.system_conversation_id           │
          text, external_ref, status, time_stamp=now()                 │
          ad_id = "" (vacío)                                           │
        [Mod 39] RETURN (id_interaction)                               │
```

### 4.3 Lógica de idempotencia — Análisis detallado

El Mod 2 busca en `interactions` por `external_ref`. El Mod 30 tiene un filtro que **solo deja pasar si** el Mod 2 **no devolvió** external_ref (es decir, la búsqueda no encontró nada).

**¿Cómo funciona?**
1. Si `external_ref` = "wamid.abc123" y NO existe en la DB → Mod 2 devuelve bundle vacío (sin external_ref) → Mod 30 pasa → se crea la interacción ✅
2. Si `external_ref` = "wamid.abc123" y YA existe en la DB → Mod 2 devuelve el registro → Mod 30 bloquea (external_ref existe) → no se duplica ✅
3. Si `external_ref` = "" (vacío) → Mod 2 busca `WHERE external_ref = ''` → **encuentra los 13,929 registros con external_ref vacío** → Mod 30 bloquea → **el mensaje nuevo se pierde silenciosamente** 🔴
4. Si `external_ref` = "2" → Mod 2 busca `WHERE external_ref = '2'` → **encuentra los 11,608 registros con external_ref "2"** → Mod 30 bloquea → **el mensaje se pierde** 🔴

**Impacto:** Los flujos que no envían external_ref válido probablemente están perdiendo mensajes después del primer mensaje que se guardó con ese valor inválido.

**Fix recomendado:** Agregar validación antes del check: si `external_ref` está vacío o es "2", saltar la verificación de idempotencia y siempre insertar.

### 4.4 Lógica de creación de persona

Cuando NO existe conversación previa (Ruta 1), el subscenario crea una persona nueva con **solo dos campos**:
- `first_name` = var.input.person_name (puede ser vacío si viene de Instagram)
- `creation_datetime` = now()

**Problemas:**
1. No verifica si la persona ya existe por otro canal → puede crear duplicados
2. No crea registro en `person_contacts` → la info de contacto formal no se registra
3. Si `person_name` viene vacío (Instagram), crea una persona sin nombre

### 4.5 Manejo de media

Cuando hay `media_data`, el subscenario:
1. Llama a SCN_3729890 ("Save media into bucket") con:
   - `binary_data` = el base64 de la media
   - `media_name` = `"interaction_medias/interaction_media_{interaction_id} (1)"`
   - `media_extension` = extensión del archivo
   - `media_external_id` = ID/nombre externo
2. Recibe `media_id` de vuelta
3. Inserta en `interaction_medias` vinculando interaction_id + media_id

**Nota importante:** El `media_name` define la ruta en Supabase Storage (bucket). El formato incluye "(1)" al final, probablemente para evitar colisiones. El archivo queda en `interaction_medias/interaction_media_99999 (1).jpg`.

### 4.6 Configuración del escenario

```
roundtrips: 1
maxErrors: 3
autoCommit: true
sequential: false
instant: false (no es webhook, es subscenario)
```

La opción `isToManageDataInSharedTransaction: true` está habilitada en TODOS los módulos de Postgres, lo que significa que todas las operaciones se ejecutan dentro de una transacción compartida de Make. Esto es bueno para consistencia.

---

## 5. SUBSCENARIO "CREATE NEW CONVERSATION" (SCN_3730131)

Crea una nueva conversación con todos sus vínculos en **una sola query atómica** usando CTEs.

### 5.1 Interfaz

**Input:**
```
provider_name    text (req)  "nombre del provedor de chat (WhatsApp, Instagram, Messanger)"
channel_address  text (req)  "Addres del canal"
person_address   text (req)  "Address de la persona con el que se creara la conversacion"
person_id        text (req)  "id de la persona con la que se crea la conversacion"
```

**Output:**
```
id_system_conversation   text (req)  "id de la conexion entre la conversacion y el channel"
id_person_conversation   text (req)  "id de la conxion entre la persona y la conversacion"
```

### 5.2 Query SQL (Mod 16)

```sql
WITH channel_data AS (
  -- 1. Busca el canal por provider_name + channel_address
  SELECT c.id AS channel_id
  FROM channel_providers cp
  JOIN channels c ON c.id_channel_provider = cp.id
  WHERE cp.name = '{provider_name}' AND c.address = '{channel_address}'
),
person_data AS (
  -- 2. Busca la persona recién creada
  SELECT id AS person_id FROM persons WHERE id = {person_id}
),
conversation_data AS (
  -- 3. Crea una conversación vacía (solo start_date = now() por default)
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id AS conversation_id
),
system_data AS (
  -- 4. Vincula la conversación con el canal
  INSERT INTO system_conversation (id_channel, id_conversation)
  SELECT channel_data.channel_id, conversation_data.conversation_id
  FROM channel_data, conversation_data
  RETURNING id AS system_conversation_id
),
person_conversation_data AS (
  -- 5. Vincula la persona con la conversación y guarda su address
  INSERT INTO person_conversation (id_person, id_conversation, address)
  SELECT person_data.person_id, conversation_data.conversation_id, '{person_address}'
  FROM person_data, conversation_data
  RETURNING id AS person_conversation_id
)
-- 6. Retorna los IDs creados
SELECT system_data.system_conversation_id, person_conversation_data.person_conversation_id
FROM system_data, person_conversation_data
```

### 5.3 Observaciones

**Lo bueno:**
- Query atómico con CTEs — todo en una transacción, si algo falla se hace rollback completo
- Diseño limpio que respeta el modelo de datos

**Lo que falta:**
- No crea registro en `person_contacts` — el address del lead se guarda solo en `person_conversation.address`
- Si `channel_address` no matchea ningún canal en la DB (typo o canal no configurado), el CTE devuelve vacío y el INSERT falla silenciosamente

### 5.4 Return (Mod 17)

Simplemente toma los resultados del SQL y los retorna:
- `id_person_conversation` = 16.person_conversation_id
- `id_system_conversation` = 16.system_conversation_id

---

## 6. ETAPA 2.5 — PREPROCESAMIENTO: "[Prepross] Media Analisis - prod"

Este flujo analiza la media adjunta a cada interacción nueva usando GPT-5.2 y Whisper, guardando la descripción/transcripción en la tabla `medias`.

### 6.1 Configuración

```
Tipo: instant = true (se dispara por webhook)
Trigger: Supabase webhook "Pre-Processing - Produccion" (hook ID: 1881112)
  → Se dispara cuando cambia un registro en la tabla interactions
```

### 6.2 Diagrama de flujo detallado

```
[Mod 2] Supabase Webhook (interactions change)
    │   Recibe: record (el registro completo de la interacción)
    │
    ▼
[Mod 3] FILTER + SLEEP
    │   Filter: record.status = 'new' (solo procesa interacciones nuevas)
    │   Sleep: 10 segundos
    │   ⚠️ El sleep es un workaround para esperar que SCN_3729890 termine
    │      de subir el archivo al bucket antes de intentar descargarlo
    │
    ▼
[Mod 4] SQL: Buscar media asociada
    │   SELECT m.id AS media_id, m.content_dir, m.type
    │   FROM interaction_medias im
    │   JOIN medias m ON m.id = im.media_id
    │   WHERE im.interaction_id = {record.id}
    │   LIMIT 1
    │   continueWhenNoRes = true
    │
    ▼
[Mod 5] ROUTER (con else):
    │
    │
    ╔══════════════════════════════════════════════════════════════╗
    ║  RUTA 1: Tiene media (4.media_id EXISTS)                    ║
    ╚══════════════════════════════════════════════════════════════╝
    │
    ▼
[Mod 6] HTTP POST → Crear signed URL en Supabase Storage
    │   URL: https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/object/sign/{content_dir}
    │   Body: { "expiresIn": 3600 }  (URL válida por 1 hora)
    │   Auth: API key "supabase prod"
    │
    ▼
[Mod 7] HTTP Download → Descargar archivo usando signed URL
    │   URL: https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/{signedURL}
    │   Auth: ninguna (la signed URL ya tiene permisos)
    │   → Devuelve: data (binario), headers.content-type, fileName
    │
    ▼
[Mod 8] ROUTER por content-type (con else = ruta 4):
    │
    ├──── Ruta 1: content-type CONTIENE "image" ──────────────────┐
    │                                                               │
    │   [Mod 9] OpenAI GPT-5.2: Analyze Images                    │
    │     Modelo: gpt-5.2                                          │
    │     Input: imagen binaria (imageFile)                        │
    │     Max tokens: 2048                                         │
    │     Temperature: 1, Top P: 1                                 │
    │     Prompt: (ver sección 6.3)                                │
    │     → Devuelve: result (texto del análisis)                  │
    │                                                               │
    │   [Mod 10] SQL: Actualizar status + guardar análisis         │
    │     UPDATE interactions SET status = 'preprocessed'          │
    │       WHERE id = {record.id};                                │
    │     UPDATE medias SET description =                          │
    │       'Analisis de la imagen:\n{9.result}'                   │
    │       WHERE id = {4.media_id};                               │
    │                                                               │
    ├──── Ruta 2: content-type CONTIENE "audio" ──────────────────┐
    │                                                               │
    │   [Mod 11] OpenAI Whisper: Transcribir audio                 │
    │     Modelo: gpt-4o-mini-transcribe                           │
    │     Input: archivo de audio (fileName = "audio.{4.type}")    │
    │     Temperature: 1                                           │
    │     Prompt: "transcribe este audio"                          │
    │     → Devuelve: text (transcripción)                         │
    │                                                               │
    │   [Mod 12] SQL: Actualizar status + guardar transcripción    │
    │     UPDATE interactions SET status = 'preprocessed'          │
    │       WHERE id = {record.id};                                │
    │     UPDATE medias SET description =                          │
    │       'Contenido del audio:\n{get(11.text; "text")}'         │
    │       WHERE id = {4.media_id};                               │
    │                                                               │
    │   ⚠️ Nota: usa get(11.text; "text") para extraer el texto   │
    │      del objeto de respuesta de Whisper                      │
    │                                                               │
    ├──── Ruta 3: content-type CONTIENE "application" ────────────┐
    │                                                               │
    │   [Mod 13] OpenAI GPT-5.2: Create Model Response            │
    │     Modelo: gpt-5.2                                          │
    │     Tipo: file prompt (sube el archivo al API)               │
    │     Input: fileName + fileData del download                  │
    │     store: true, truncation: auto                            │
    │     createConversation: true                                 │
    │     Prompt: (ver sección 6.4)                                │
    │     → Devuelve: result (texto del análisis)                  │
    │                                                               │
    │   [Mod 14] SQL: Actualizar status + guardar análisis         │
    │     UPDATE interactions SET status = 'preprocessed'          │
    │       WHERE id = {record.id};                                │
    │     UPDATE medias SET description =                          │
    │       'Contenido del Archivo:\n{13.result}'                  │
    │       WHERE id = {4.media_id};                               │
    │                                                               │
    └──── Ruta 4 (else): Tipo no soportado ───────────────────────┐
                                                                    │
        [Mod 15] SQL: Marcar como no analizable                    │
          UPDATE interactions SET status = 'preprocessed'          │
            WHERE id = {record.id};                                │
          UPDATE medias SET description =                          │
            'Actualmente no es posible analizar la media...\n      │
             Tipo de media: {content-type}'                        │
            WHERE id = {4.media_id};                               │
    │
    │
    ╔══════════════════════════════════════════════════════════════╗
    ║  RUTA 2 (else): Sin media                                    ║
    ╚══════════════════════════════════════════════════════════════╝
    │
    ▼
[Mod 16] SQL: Solo marcar como preprocessed
    │   UPDATE interactions SET status = 'preprocessed'
    │     WHERE id = {record.id};
    │   (no hay nada que analizar, simplemente avanza el status)
```

### 6.3 Prompt de análisis de imágenes (Mod 9, completo)

```
Eres un agente dedicado únicamente a analizar imágenes. Tu tarea es observar
la imagen y devolver un único resultado en texto plano, sin usar listas,
viñetas, numeración, tablas, JSON, diccionarios ni formato estructurado.
Escribí en párrafos normales.

Reglas obligatorias:
No inventes información. No completes datos faltantes. Si un dato no es
visible o no se puede leer con certeza, indicá explícitamente que no es
legible o no es visible.

Siempre debés incluir una descripción de la imagen al comienzo:
Si la imagen es un comprobante de pago, boleta, ticket, recibo, transferencia,
depósito o captura de pantalla de una operación, la descripción debe ser breve
y decir que es un comprobante (por ejemplo: "La imagen es un comprobante de pago.").
Si la imagen no es un comprobante ni algo similar, la descripción debe ser más
detallada e incluir toda la información relevante que se observe.

Si la imagen es un comprobante (o similar), extraé toda la información
disponible sin omitir nada, incluyendo cuando sea posible:
Fechas y horas, importes, moneda, concepto o descripción de la operación,
estado (aprobado, pendiente, rechazado), medio de pago, banco/entidad,
nombre y/o identificador del comercio o destinatario, nombre y/o identificador
del pagador u ordenante, números de operación o referencia, identificadores
(CBU/alias/cuenta/tarjeta), cuotas (si aplica), comisiones o impuestos
(si aparecen), y cualquier otro dato textual presente.

Formato de salida:
Entregá primero la descripción y luego la extracción de datos en texto
corrido, separando por oraciones y usando claridad, pero siempre en texto plano.
```

**Observación:** El prompt está fuertemente orientado a **comprobantes de pago**, lo cual tiene sentido para IITA que recibe pagos por cursos. Para imágenes que no son comprobantes, pide descripción detallada genérica.

### 6.4 Prompt de análisis de archivos (Mod 13, completo)

```
Sos un agente dedicado únicamente a analizar archivos. Tu tarea es leer el
contenido del archivo y devolver un único resultado en texto plano, sin usar
listas, viñetas, numeración, tablas, JSON, diccionarios ni formato estructurado.
Escribí en párrafos normales.

[... mismas reglas que imágenes, adaptadas a archivos ...]

Si el archivo tiene varias páginas, integrá toda la información en un solo
texto final, sin duplicar innecesariamente, pero sin perder datos.
```

### 6.5 Modelos y costos

| Tipo de media | Modelo | Método API | Costo relativo |
|--------------|--------|-----------|----------------|
| Imagen | gpt-5.2 | analyzeImages | 🔴 Alto (Vision + modelo premium) |
| Audio | gpt-4o-mini-transcribe | CreateTranscription | 🟢 Bajo |
| PDF/docs | gpt-5.2 | createModelResponse (file) | 🔴 Alto |
| Otro | — | — | Gratis (solo UPDATE SQL) |

### 6.6 El problema del Sleep de 10 segundos

El Sleep en Mod 3 existe porque:
1. El webhook de Supabase se dispara cuando se **crea** la interacción (status='new')
2. Pero el archivo puede **aún no estar subido** al bucket (el subscenario "Save media" puede estar ejecutándose)
3. Si el flujo intenta descargar antes de que termine la subida, falla

**Problemas con este approach:**
- 10 segundos es arbitrario — si la subida tarda más (archivo grande, red lenta), falla
- Si la subida es rápida (1 segundo), desperdicia 9 segundos de operación Make
- No hay retry — si falla, el mensaje queda en status='new' permanentemente

**Fix ideal:** Cambiar la arquitectura para que el webhook se dispare DESPUÉS de que el media se guarda (trigger en `interaction_medias` en vez de `interactions`), o implementar un polling/retry.

---

## 7. ETAPA 3 — GENERACIÓN DE RESPUESTA AI: "[RG] Generate ai response - prod"

### 7.1 Trigger y condiciones

El flujo se activa por un **Supabase webhook** (`Respond Generation - Prod`) que observa cambios en la tabla `interactions`.

```
Mod 2: Webhook "Respond Generation - Prod"
         │
Mod 3: Filter + Sleep
         │  Condiciones:
         │    status = 'preprocessed'
         │    id_person_conversation EXISTS y no vacío
         │  + SLEEP 60 segundos (espera arbitraria)
         │
         └─→ Si pasa filtro: continúa a Mod 4
```

**¿Por qué el Sleep de 60 segundos?** Similar al Sleep de 10s en Media Analysis, es un approach de timing arbitrario. Probablemente intenta asegurar que todos los mensajes de una "ráfaga" del usuario lleguen antes de generar respuesta. No es event-driven.

### 7.2 Recopilación de contexto (Mod 4)

Una consulta SQL compleja obtiene todo el contexto necesario para la generación:

```sql
-- Datos que extrae:
-- 1. Últimas 10 interacciones de la conversación (ORDER BY time_stamp DESC LIMIT 10)
-- 2. Mensajes no respondidos del usuario (posteriores a la última respuesta del sistema)
-- 3. Información del canal: channel_address, channel_name, person_address, channel_provider_id
-- 4. Texto formateado de conversación:
--    "- role (timestamp): [texto del mensaje]: ... [media del mensaje]: ..."
-- 5. Texto formateado de mensajes no respondidos (mismo formato)
-- 6. Array JSON de todas las interacciones
```

**Campos resultantes disponibles para el agente:**
- `conversation_text` — historial formateado con roles y timestamps
- `unanswered_text` — solo los mensajes sin responder del usuario
- `channel_address`, `channel_name`, `person_address`, `channel_provider_id`
- `interactions_json` — array completo para referencia
- `last_interaction_id` — para filtro de deduplicación

### 7.3 Llamada al agente AI (Mod 5)

```
Mod 5: AI Agent "Atención al cliente y asesor de cursos (Activo)"
         │
         │  Filtro interno: last_interaction_id == id del trigger
         │  (evita generar respuesta si otra interacción más reciente ya disparó el proceso)
         │
         │  Messages enviados al agente:
         │    [1] "Historial de conversación (contexto):\n{conversation_text}"
         │    [2] "Ultimos mensajes (responder a esto):\n{unanswered_text}"
         │
         │  Error handler → Mod 6: Break con 5 reintentos, intervalo 15 segundos
         │
         └─→ Respuesta del agente → Mod 7
```

**Patrón de deduplicación:** Si un usuario envía 3 mensajes rápidos, cada uno dispara el webhook. El Sleep de 60 segundos los deja "acumular", y luego el filtro `last_interaction_id == trigger_id` asegura que solo el ÚLTIMO mensaje genera respuesta. Los otros fallan silenciosamente en el filtro.

### 7.4 Registro de respuesta y system prompt (Mod 7)

```sql
INSERT INTO ai_interaction (
    associated_interaction_id,  -- la interacción que disparó la generación
    response,                   -- texto generado por el agente
    evaluation,                 -- 'pending' (siempre empieza así)
    system_prompt               -- ⚠️ PROMPT COMPLETO HARDCODEADO AQUÍ
)
```

**⚠️ BUG ARQUITECTÓNICO:** El system prompt NO está en la configuración del agente AI en Make.com. Está **hardcodeado directamente** en el campo `system_prompt` del INSERT INTO. Esto significa que para cambiar el prompt hay que editar el escenario de Make.com, y que el prompt se almacena repetido en cada registro de `ai_interaction`.

### 7.5 Contenido del system prompt (persona "Ana")

El prompt define una persona llamada **"Ana"** que actúa como vendedora de cursos de IITA con las siguientes instrucciones clave:

- **Rol:** Atención al cliente y asesora de cursos para IITA
- **Restricción de edad:** Debe verificar que el lead es mayor de 13 años; menores deben consultar con tutor
- **Estrategia de venta:** Persuasión orientada a inscripción, énfasis en beneficios de los cursos
- **Proceso de inscripción:** Guía al lead a través de pasos: elegir curso → elegir sede → consultar horarios → proporcionar datos personales → forma de pago
- **Manejo de objeciones:** Respuestas predefinidas para objeciones comunes (precio, tiempo, distancia)
- **Información de cursos:** Catálogo completo con precios, duraciones, sedes disponibles
- **Tono:** Amigable, informal pero profesional, uso de emojis moderado

### 7.6 Routing a Google Sheets (Mod 8)

Después de insertar el `ai_interaction`, el flujo escribe la respuesta en una Google Sheet para revisión humana:

```
Mod 8: Router "¿Sheet?"
         │
         ├─ Si channel_name contiene "san" → Mod 9: Google Sheets "San Lorenzo Chico"
         │
         └─ Else → Mod 10: Google Sheets "Salta"
```

**Columnas populadas en la Sheet:**

| Columna | Contenido |
|---------|-----------|
| A | channel_address |
| B | timestamp de la interacción |
| C | provider (whatsapp/instagram/etc) |
| D | person_address |
| E | unanswered_text (mensajes del usuario) |
| F | external_ref de la interacción |
| G | **Respuesta generada por AI** |
| H | (vacío — checkbox de aprobación, lo marca el operador) |
| I | (vacío — status, se actualiza por otros flujos) |
| L | interaction_id (referencia para tracking) |

### 7.7 Diagrama de flujo completo

```
Supabase webhook (interactions change)
         │
         ▼
    ┌──────────┐
    │ Filter   │ status='preprocessed'
    │ + Sleep  │ id_person_conversation exists
    │ 60 seg   │
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ SQL      │ Lee últimas 10 interacciones
    │ Context  │ + mensajes no respondidos
    │ Query    │ + info de canal
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ AI Agent │ "Atención al cliente y asesor de cursos"
    │ + Filter │ last_interaction_id == trigger_id
    │          │ (deduplicación)
    └────┬─────┘
         │ (5 retries, 15s interval)
         ▼
    ┌──────────┐
    │ INSERT   │ ai_interaction
    │          │ evaluation = 'pending'
    │          │ system_prompt = hardcoded
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ Router   │ ¿channel_name contiene "san"?
    │ Sheet    ├─→ Sí: Sheet "San Lorenzo Chico"
    │          ├─→ No: Sheet "Salta"
    └──────────┘
```

---

## 8. ETAPA 3.5 (PROPUESTA) — EVALUACIÓN Y FILTRADO POST-GENERACIÓN

> **NOTA:** Esta etapa NO existe actualmente en producción. Es una propuesta arquitectónica para reducir la carga de revisión manual y mejorar la calidad del sistema.

### 8.1 Problema que resuelve

Actualmente, **TODAS** las respuestas AI pasan por revisión manual en Google Sheets. Esto crea varios problemas:

1. **Cuello de botella humano:** Cada respuesta requiere que un operador la lea y apruebe
2. **Sin filtro de calidad:** Respuestas incoherentes, spam, loops de auto-respuesta llegan a la Sheet igual que respuestas legítimas
3. **Sin priorización:** El operador no sabe cuáles requieren más atención
4. **Deadline de 24 horas:** Si no se aprueba en 24h, la respuesta se marca "Fuera de plazo" y se pierde

### 8.2 Arquitectura propuesta

```
                          ETAPA 3 (actual)              ETAPA 3.5 (nueva)           ETAPA 4 (actual)
                          ─────────────────             ─────────────────           ─────────────────
ai_interaction creado ──→ evaluation='pending' ──→ [EVALUACIÓN AUTOMÁTICA] ──→ ¿Pasó todos los checks?
                                                     │                              │
                                                     ├─ Auto-responder loop?       ├─ SÍ → evaluation='auto_approved'
                                                     ├─ Spam/frecuencia?           │       → Crea interacción saliente
                                                     ├─ Sentimiento negativo?      │         (status='pending_delivery')
                                                     ├─ Contexto incoherente?      │
                                                     └─ Off-topic?                 └─ NO → evaluation='manual_review'
                                                                                           → flags=JSON con razones
                                                                                           → Va a cola CRM Dashboard
```

### 8.3 Trigger

**Supabase webhook** en tabla `ai_interaction` para INSERT WHERE `evaluation = 'pending'`.

### 8.4 Módulos de evaluación (ejecución en paralelo)

#### Módulo 1: Detección de auto-responder loop

```
Consulta: SELECT últimas 10 interacciones de la conversación
Lógica:
  - Contar mensajes consecutivos del sistema SIN respuesta del usuario
  - Si > 3 mensajes consecutivos del sistema → flag = 'auto_responder_loop'
  - Patrones a detectar: "Gracias por contactarnos", "Estamos fuera de horario",
    respuestas genéricas repetitivas
Propósito: Evitar que el sistema siga respondiendo cuando el otro lado
           es un bot/auto-responder que genera loops infinitos
```

#### Módulo 2: Detección de spam / alta frecuencia

```
Consulta: SELECT conteo de mensajes del person_conversation en última hora
Lógica:
  - Si > 10 mensajes en última hora del mismo contacto → flag = 'high_frequency_spam'
  - Pattern matching en texto: URLs sospechosas, números de teléfono,
    keywords promocionales
  - Detección de ofertas de trabajo, publicidad de servicios,
    productos no relacionados
Propósito: Filtrar contactos que hacen spam al sistema
```

#### Módulo 3: Análisis de sentimiento

```
Herramienta: GPT-4o-mini (bajo costo)
Prompt: "Analiza el sentimiento de esta conversación. Devuelve:
         positive/neutral/negative/angry.
         Si angry o frustrated, explica por qué."
Lógica:
  - Si sentimiento = 'angry' → flag = 'negative_sentiment'
  - Almacenar score en ai_interaction
Propósito: Escalar conversaciones conflictivas a atención humana inmediata
```

#### Módulo 4: Validación de contexto / coherencia

```
Herramienta: GPT-4o-mini
Prompt: "¿Esta respuesta AI tiene sentido dado el historial de conversación?
         ¿Responde a la pregunta real del usuario?
         Devuelve: coherent/incoherent/off_topic con explicación."
Lógica:
  - Si incoherent o off_topic → flag = 'context_mismatch'
Propósito: Detectar respuestas donde el agente "alucinó" o malinterpretó
```

#### Módulo 5: Detección de off-topic

```
Lógica: Pattern matching en mensajes del usuario
Patterns: "trabajo", "empleo", "publicidad", "marketing",
          "venta de servicios", "ofrezco", "busco trabajo"
Si detectado → flag = 'off_topic_job_offer' o 'off_topic_advertising'
Propósito: Filtrar contactos que no son leads reales
```

### 8.5 Lógica de decisión (Router final)

```
SI todos los flags = null:
  → UPDATE ai_interaction SET evaluation = 'auto_approved'
  → CALL subscenario "Create new interaction" con:
      text = respuesta AI
      status = 'pending_delivery'
      is_user = false
  → (Esto dispara automáticamente el envío en Etapa 5)

SI algún flag existe:
  → UPDATE ai_interaction SET evaluation = 'manual_review',
      flags = '["auto_responder_loop", "negative_sentiment"]'  (JSON array)
  → Aparece en cola de revisión del CRM Dashboard con las razones
```

### 8.6 Beneficios esperados

| Métrica | Sin evaluación (actual) | Con evaluación (propuesta) |
|---------|------------------------|---------------------------|
| Mensajes revisados manualmente | 100% | ~20-40% |
| Tiempo promedio de respuesta | Depende del operador | Segundos (auto-approved) |
| Loops de auto-responder detectados | 0% | ~95% |
| Spam enviado al usuario | Todo pasa | Filtrado automáticamente |
| Conversaciones urgentes priorizadas | No | Sí (flags en CRM) |

### 8.7 Schema de base de datos necesario

```sql
-- Nueva tabla para flags detallados
CREATE TABLE ai_interaction_flags (
    id SERIAL PRIMARY KEY,
    ai_interaction_id INTEGER REFERENCES ai_interaction(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL,        -- 'auto_responder_loop', 'spam', 'negative_sentiment', etc.
    flag_reason TEXT,               -- explicación legible
    confidence NUMERIC(3,2),        -- 0.00-1.00, confianza del detector
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modificación a ai_interaction (ya existe evaluation, agregar flags)
ALTER TABLE ai_interaction ADD COLUMN flags JSONB DEFAULT '[]';

-- Nueva tabla para prompts versionados (ver bug #10)
CREATE TABLE system_prompts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,             -- 'ana_vendedora', 'evaluacion_sentimiento', etc.
    prompt_text TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. ETAPA 4 — APROBACIÓN VÍA GOOGLE SHEETS: "Generate interactions from Google Sheets"

### 9.1 Trigger

**Google Sheets webhook** (`Casillero OK (Producción)`) que observa actualizaciones de celdas en tiempo real.

### 9.2 Condiciones de activación (Mod 3)

```
Mod 3: Router "¿Out of deadline?"
         │
         │  Filtro base:
         │    Columna H (checkbox OK) = "true"  ← operador marcó aprobación
         │    Columna I (status) = vacío         ← no fue procesada aún
         │    Columna B (timestamp) existe       ← tiene fecha válida
         │
         ├─ Ruta 1: "Sí, fuera de plazo"
         │    Condición: now() > timestamp_columna_B + 1 día
         │    → Mod 4: UPDATE Sheet columna I = "Fuera de plazo"
         │    (La respuesta se descarta — pasó demasiado tiempo)
         │
         └─ Ruta 2: "No, dentro de plazo"
              → Continúa al proceso de creación
```

**Ventana de aprobación:** 24 horas desde que se generó la respuesta. Si el operador tarda más, la respuesta es inválida y se marca como vencida.

### 9.3 Creación de interacción saliente (Ruta 2)

```
Mod 5: CALL subscenario SCN_3730125 "Create new interaction"
         │  Parámetros:
         │    text = columna G (respuesta AI generada)
         │    status = "pending_delivery"    ← esto dispara el envío
         │    is_user = false                ← es mensaje del sistema
         │    provider_name = lowercase(columna C)
         │    channel_address = columna A
         │    person_address = columna D
         │
         ▼
Mod 6: UPDATE ai_interaction
         SET generated_interaction_id = {id retornado por subscenario}
         │
         ▼
Mod 7: UPDATE Google Sheet
         columna I = "Pendiente"
         columna L = {interaction_id}
```

**Patrón clave:** Al crear la interacción con status `'pending_delivery'`, automáticamente se dispara el webhook de la Etapa 5 (envío). El operador solo necesita marcar el checkbox.

### 9.4 Relación entre tablas

```
ai_interaction                    interactions (saliente)
┌──────────────────────┐         ┌──────────────────────┐
│ id = 500             │         │ id = 102500          │
│ associated_          │         │ text = "¡Hola! Soy   │
│   interaction_id=102231│        │  Ana de IITA..."     │
│ response = "¡Hola!   │    ┌──→│ status = 'pending_   │
│  Soy Ana de IITA..." │    │   │  delivery'            │
│ evaluation='pending' │    │   │ is_user = false       │
│ generated_           │────┘   │ id_person_            │
│   interaction_id=102500│       │  conversation = 25878 │
│ system_prompt = "..."│         └──────────────────────┘
└──────────────────────┘
```

---

## 10. ETAPA 5 — ENVÍO DE MENSAJES

### 10.1 Orquestador: "Sending messages (Producción)"

**Trigger:** Supabase webhook (`Pending_delivery_AND_Send`) en tabla `interactions`.

```
Mod 2: Watch interactions change
         │
Mod 3: Router "¿Status?"
         │
         ├─ Ruta 1: status = 'pending_delivery'
         │    Filtro: id_person_conversation NO existe AND status='pending_delivery'
         │    → Mod 4: CALL SCN_4124755 "Message dispatcher" (asíncrono)
         │
         └─ Ruta 2: status = 'send'
              Filtro: id_person_conversation NO existe AND status='send'
              → Router "¿Headquarters?"
                  ├─ Salta → Mod 6-7: Buscar en Sheet "Salta" + UPDATE "Enviado" + timestamp
                  └─ San Lorenzo → Mod 8-9: Buscar en Sheet "San Lorenzo Chico" + UPDATE "Enviado"
```

**Dos funciones del orquestador:**
1. **pending_delivery:** Dispara el dispatcher para enviar el mensaje
2. **send:** Actualiza la Google Sheet con confirmación de envío (tracking)

### 10.2 Dispatcher: "IITA - Message dispatcher (Producción)" (SCN_4124755)

El dispatcher recibe un `id_interaction`, consulta la base de datos, y enruta al escenario de envío correcto.

```
Mod 23: StartSubscenario (input: id_interaction)
         │
Mod 22: SQL Query
         │  SELECT system_conversation, person_address, channel info,
         │         interaction text/status
         │  WHERE status='pending_delivery' AND id = {input}
         │
Mod 8: UPDATE interactions SET status = 'sending' WHERE id = {id}
         │
Mod 5: Router "¿Channel provider?"
         │
         ├─ id_channel_provider = 1 (WhatsApp)
         │    └─ Router "¿Channel?"
         │         ├─ 5493875809318 → SCN_4124805 "[OUT] Whatsapp ~ IITA 3D"
         │         └─ 5493876844174 → SCN_4124821 "[OUT] Whatsapp ~ San Lorenzo Chico"
         │
         ├─ id_channel_provider = 2 (Instagram)
         │    └─ Router "¿Channel?"
         │         ├─ 17841404168256335 → SCN_4124832 "[OUT] Instagram ~ Salta"
         │         └─ 17841455198100771 → SCN_4124842 "[OUT] Instagram ~ San Lorenzo Chico"
         │
         ├─ id_channel_provider = 3 (Messenger)
         │    └─ Router "¿Channel?"
         │         ├─ 296373163870909 → SCN_4124865 "[OUT] Messenger ~ Salta"
         │         └─ 106307535517599 → SCN_4124870 "[OUT] Messenger ~ San Lorenzo Chico"
         │
         └─ id_channel_provider = 4 (WhatsApp Cloud API)
              └─ Router "¿Channel?"
                   └─ 111869345312688 → SCN_4124875 "[OUT] Whatsapp ~ Chatbot"
```

**Routing jerárquico:** Provider → Channel address específico → Escenario dedicado.
Todas las llamadas son **asíncronas** (`shouldWaitForExecutionEnd = false`).

### 10.3 Transiciones de status en el envío

```
pending_delivery → sending → send
      │               │          │
      │               │          └─ Mensaje entregado exitosamente
      │               └─ Dispatcher actualizó, escenario outbound procesando
      └─ Aprobado en Google Sheet, esperando dispatcher
```

### 10.4 Escenarios outbound (detalle)

Todos los escenarios outbound siguen el mismo patrón de 3 pasos:

```
Mod 1: StartSubscenario
         │  Inputs: channel_address, person_address, text, id_interaction
         │
Mod X: API Call (envío del mensaje)
         │
Mod Y: UPDATE interactions
         SET status = 'send',
             time_stamp = now(),
             external_ref = {ID del mensaje en la plataforma}
         WHERE id = {id_interaction} AND status = 'sending'
```

**Diferencias por canal:**

| Escenario | API Endpoint | Auth | Notas |
|-----------|-------------|------|-------|
| **[OUT] WA ~ Chatbot** | `graph.facebook.com/v17.0/100436536473788/messages` | API Key "Whatsapp Cloud API" | HTTP POST directo, `messaging_product: "whatsapp"` |
| **[OUT] WA ~ San Lorenzo** | Módulo nativo Make.com WhatsApp Business | Conexión "IITA San Lorenzo - WhatsApp Business (Coexistence)" | Sender ID: 102522002867267, usa módulo de Make |
| **[OUT] WA ~ IITA 3D** | (Similar a San Lorenzo) | Conexión WhatsApp Business Coexistence | Canal histórico Salta |
| **[OUT] IG ~ Salta** | `graph.instagram.com/v22.0/me/messages` | API Key específica | `messaging_type: "RESPONSE"` |
| **[OUT] IG ~ San Lorenzo** | `graph.instagram.com/v22.0/me/messages` | API Key "IITA San Lorenzo Instagram" | Mismo endpoint, diferente auth |
| **[OUT] Messenger ~ Salta** | (Graph API Messenger) | API Key Facebook | `messaging_type: "RESPONSE"` |
| **[OUT] Messenger ~ San Lorenzo** | (Graph API Messenger) | API Key Facebook SL | Mismo patrón |

### 10.5 Mapa de canales completo (address ↔ escenario)

| Provider | Channel Address | Sede | Escenario ID | Nombre |
|----------|----------------|------|-------------|--------|
| WhatsApp (1) | 5493875809318 | Salta | SCN_4124805 | [OUT] WA ~ IITA 3D |
| WhatsApp (1) | 5493876844174 | San Lorenzo | SCN_4124821 | [OUT] WA ~ San Lorenzo |
| Instagram (2) | 17841404168256335 | Salta | SCN_4124832 | [OUT] IG ~ Salta |
| Instagram (2) | 17841455198100771 | San Lorenzo | SCN_4124842 | [OUT] IG ~ San Lorenzo |
| Messenger (3) | 296373163870909 | Salta | SCN_4124865 | [OUT] Messenger ~ Salta |
| Messenger (3) | 106307535517599 | San Lorenzo | SCN_4124870 | [OUT] Messenger ~ San Lorenzo |
| WA Cloud API (4) | 111869345312688 | Chatbot | SCN_4124875 | [OUT] WA ~ Chatbot |

---

## 11. RECORRIDO COMPLETO DE UN MENSAJE (ejemplo paso a paso)

### Ejemplo: Lead envía foto de comprobante por WhatsApp Cloud API

```
Paso 1: Lead envía "Hola, adjunto comprobante" + foto por WhatsApp al número 111869345312688
         │
Paso 2: Meta envía webhook al flujo "[INPUT] IITA Chatbot - WhatsApp Cloud API"
         │  Flujo extrae:
         │    external_ref = "wamid.HBgNNTQ5Mzg3..."
         │    provider_name = "whatsapp cloud api"
         │    channel_address = "111869345312688"
         │    person_address = "5493871234567"
         │    person_name = "María García"
         │    text = "Hola, adjunto comprobante"
         │    status = "new"
         │  Descarga imagen de Meta API → convierte a base64
         │  Llama subscenario SCN_3730125 con media_data, media_extension="jpg"
         │
Paso 3: Subscenario "Create new interaction" ejecuta:
         │  Mod 2: SELECT WHERE external_ref = "wamid.HBg..." → no encontrado ✅
         │  Mod 30: Busca conversación por provider+channel+person
         │
         │  [Si primera vez que escribe:]
         │    Mod 9: INSERT persons (first_name='María García') → person_id=25557
         │    Mod 7: CALL "Create new conversation"
         │           → CTE atómico crea conversation + system_conversation + person_conversation
         │           → Retorna id_system_conversation=25867, id_person_conversation=25878
         │    Mod 11: INSERT interactions (status='new', id_person_conversation=25878) → interaction_id=102231
         │    Mod 45: CALL "Save media into bucket"
         │           → Sube JPG a Storage: interaction_medias/interaction_media_102231 (1).jpg
         │           → INSERT medias (content_dir=..., type=jpg) → media_id=45
         │    Mod 48: INSERT interaction_medias (interaction_id=102231, media_id=45)
         │    Return: id_interaction=102231, id_person_conversation=25878
         │
         │  [Si ya escribió antes:]
         │    Mod 30 ya encontró person_conversation_id=25878
         │    Mod 15: INSERT interactions (id_person_conversation=25878)
         │    → misma lógica de media
         │
Paso 4: Supabase webhook detecta INSERT en interactions con status='new'
         │  Flujo "[Prepross] Media Analisis - prod" se activa
         │  Mod 3: Filter status='new' ✅ → Sleep 10 segundos
         │  Mod 4: SELECT media → media_id=45, content_dir="interaction_medias/interaction_media_102231 (1).jpg"
         │  Mod 6: HTTP POST signed URL → obtiene URL temporal
         │  Mod 7: HTTP Download → descarga imagen del bucket
         │  Mod 8: content-type = image/jpeg → Ruta 1
         │  Mod 9: GPT-5.2 Vision analiza la imagen
         │         Resultado: "La imagen es un comprobante de transferencia bancaria.
         │                    Fecha: 15/02/2026, Importe: $25.000 ARS..."
         │  Mod 10: UPDATE medias SET description = 'Analisis de la imagen: ...'
         │          UPDATE interactions SET status = 'preprocessed'
         │
Paso 5: [ETAPA 3 — Generación AI]
         │  Supabase webhook detecta status='preprocessed' en interactions
         │  Flujo "[RG] Generate ai response - prod" se activa
         │  Mod 3: Filter status='preprocessed' ✅ → Sleep 60 segundos
         │  Mod 4: SQL lee últimas 10 interacciones + mensajes no respondidos
         │         conversation_text: "- user (15/02 14:30): [texto]: Hola, adjunto comprobante
         │                             [media]: Analisis de la imagen: comprobante bancario $25.000..."
         │         unanswered_text: mismos datos formateados
         │  Mod 5: Agente AI "Ana" genera respuesta:
         │         "¡Hola! 😊 Gracias por enviar el comprobante. Ya lo registré.
         │          Tu inscripción al curso de Robótica está confirmada..."
         │  Mod 7: INSERT ai_interaction:
         │         associated_interaction_id = 102231
         │         response = "¡Hola! 😊 Gracias por enviar..."
         │         evaluation = 'pending'
         │         system_prompt = (prompt completo de Ana hardcodeado)
         │  Mod 8: Router → channel_name no contiene "san" → Sheet "Salta"
         │         Escribe fila con: channel, timestamp, provider, person, texto, respuesta AI
         │
Paso 6: [ETAPA 4 — Aprobación en Google Sheet]
         │  Operador abre Sheet "Salta", lee la respuesta AI en columna G
         │  Marca checkbox en columna H = true
         │  Webhook "Casillero OK" se activa
         │  Mod 3: Router verifica: H="true" ✅, I vacío ✅, B existe ✅
         │         Verifica deadline: now < timestamp + 1 día ✅ → dentro de plazo
         │  Mod 5: CALL SCN_3730125 "Create new interaction"
         │         text = "¡Hola! 😊 Gracias por enviar el comprobante..."
         │         status = "pending_delivery"
         │         is_user = false
         │         → Crea interaction_id = 102500
         │  Mod 6: UPDATE ai_interaction SET generated_interaction_id = 102500
         │  Mod 7: UPDATE Sheet columna I = "Pendiente", columna L = 102500
         │
Paso 7: [ETAPA 5 — Envío]
         │  Supabase webhook detecta interaction 102500 con status='pending_delivery'
         │  Flujo "Sending messages" → Ruta 1 → CALL dispatcher (asíncrono)
         │  Dispatcher:
         │    Mod 22: SQL lee channel_provider_id=4 (WA Cloud API),
         │            channel_address=111869345312688
         │    Mod 8: UPDATE status = 'sending'
         │    Mod 5: Router → WA Cloud API → channel 111869345312688
         │    → CALL SCN_4124875 "[OUT] Whatsapp ~ Chatbot"
         │  Outbound:
         │    Mod 16: HTTP POST graph.facebook.com → envía mensaje WhatsApp
         │            Response: {"messages": [{"id": "wamid.HBgNNTQ5Mzg3...OUT"}]}
         │    Mod 7: UPDATE interactions SET status='send',
         │           external_ref='wamid.HBgNNTQ5Mzg3...OUT'
         │  Orquestador (segunda pasada con status='send'):
         │    Busca en Sheet "Salta" por interaction_id 102500
         │    UPDATE columna I = "Enviado", columna J = timestamp
         │
         ▼
  Lead recibe mensaje: "¡Hola! 😊 Gracias por enviar el comprobante..."
```

---

## 12. INVENTARIO DE BUGS Y PROBLEMAS

### 12.1 Bugs P0 (urgentes, afectan datos en producción)

| # | Flujo | Módulo | Bug | Impacto | Fix |
|---|-------|--------|-----|---------|-----|
| 1 | WA Cloud API | Mod 8 (Set Variable) | Caption usa `image.caption` hardcodeado | Pierde captions de video y documentos | Cambiar a la variable calculada en Mod 6 |
| 2 | WA Coex SL | Mod 6 (Set Variable) | `sticker.id` se concatena fuera del `if()` | Corrompe mediaId para TODOS los tipos de media | Mover sticker.id dentro del if() |
| 3 | WA Coex SL | Mod 7 (Set Variable) | Caption usa `video.id` | Guarda el ID del video en vez de su caption | Cambiar a `video.caption` |

### 12.2 Bugs P1 (problemas de datos, impacto acumulativo)

| # | Componente | Problema | Impacto |
|---|-----------|----------|---------|
| 4 | WA Coex SL | No envía `status` al subscenario | Interacciones quedan sin status → no son procesadas por Media Analysis |
| 5 | Subscenario CNI | Idempotencia falla con external_ref vacío o "2" | Mensajes nuevos se pierden silenciosamente si ya hay registros con ese external_ref |
| 6 | Instagram | No captura `ad_id` | Se pierde la atribución de anuncios de Meta Ads |
| 7 | Instagram | No captura `person_name` | Personas creadas sin nombre |
| 8 | Todos los flujos | No capturan `ad_id` | Tabla `ads` inutilizable para tracking |

### 12.3 Bugs P1 (flujos de salida — descubiertos en análisis de Etapas 3-5)

| # | Componente | Problema | Impacto |
|---|-----------|----------|---------|
| 9 | SCN_3729890 (Save media) | Parámetro `media_external_id` se recibe pero NUNCA se usa | No se puede correlacionar media con IDs de plataforma. Debería guardarse en columna `external_id` de `medias` (no existe) |
| 10 | [RG] Generate ai response | System prompt hardcodeado en Mod 7 (INSERT INTO ai_interaction) | Para cambiar el prompt hay que editar el escenario Make.com. El prompt se repite en cada registro. Debería estar en configuración del agente o tabla `system_prompts` |
| 11 | Todo el pipeline saliente | No existe capa de validación/evaluación entre generación AI y aprobación | 100% de respuestas requieren revisión manual. No se detectan loops, spam, respuestas incoherentes ni conversaciones off-topic |
| 12 | Google Sheets + CRM Dashboard | Dos sistemas de aprobación en paralelo | Estado inconsistente posible. Google Sheets es legacy pero sigue activo; CRM Dashboard en desarrollo. Debería consolidarse a uno solo |

### 12.4 Problemas de calidad de datos existentes

| Tipo de external_ref | Cantidad | % | Estado |
|---------------------|---------|---|--------|
| Válido (ID real de plataforma) | 76,533 | 74.9% | ✅ OK |
| Vacío ("") | 13,929 | 13.6% | 🔴 Sin referencia auditable + bloquea idempotencia |
| Literal "2" | 11,608 | 11.4% | 🔴 Bug de mapping en flujos Coexistence legacy |
| NULL | 160 | 0.2% | ⚠️ |

### 12.5 Problemas arquitectónicos

| Problema | Descripción | Riesgo |
|---------|-------------|--------|
| Sin cola de mensajes | Si el subscenario falla, el mensaje se pierde. No hay retry ni dead-letter queue. | Pérdida de mensajes |
| Sleep de 10s en Media Analysis | Tiempo arbitrario, puede ser insuficiente o excesivo | Errores intermitentes o desperdicio |
| Sleep de 60s en AI Generation | Tiempo arbitrario para esperar "ráfaga" de mensajes | Latencia innecesaria o insuficiente |
| Base64 en Instagram | Convierte TODA la media a base64 → 654 MB de consumo | Costo excesivo de operaciones Make |
| Personas duplicadas | No verifica si persona ya existe por otro canal | Datos inconsistentes |
| No crea person_contacts | El subscenario nunca registra el contacto formalmente | Tabla person_contacts incompleta |
| Media subutilizada | Solo 44 registros en medias/interaction_medias vs 102K interacciones | La mayoría de media histórica no se guardó en el bucket |
| System prompt no versionado | Prompt hardcodeado en INSERT, no en configuración | Imposible hacer A/B testing o rollback de cambios al prompt |
| Sin error handling en envío | Escenarios outbound no tienen error handlers | Si la API de Meta falla, el mensaje queda en status='sending' para siempre |

---

## 13. RECOMENDACIONES DE MEJORA (priorizadas)

### Fase 0 — Fixes urgentes (< 30 min, hacer YA)

1. **WA Cloud API — Mod 8:** Cambiar caption de `image.caption` a la variable calculada en Mod 6
2. **WA Coex SL — Mod 6:** Reestructurar el if() para que sticker.id quede dentro
3. **WA Coex SL — Mod 7:** Cambiar `video.id` a `video.caption`
4. **WA Coex SL:** Agregar `status: "new"` en la llamada al subscenario

### Fase 1 — Mejorar idempotencia (1-2 horas)

5. En el subscenario CNI, antes del Mod 2, agregar validación: si `external_ref` está vacío, generar uno (ej: `{provider}_{channel}_{person}_{timestamp}`)
6. Agregar UNIQUE INDEX en `interactions.external_ref` WHERE external_ref != '' AND external_ref != '2' (parcial)

### Fase 2 — Capa de evaluación post-generación (2-3 días)

7. Crear tabla `ai_interaction_flags` (ver §8.7)
8. Crear tabla `system_prompts` y migrar prompt hardcodeado de Mod 7
9. Implementar flujo "[Evaluation] AI Response Quality Check" con 5 módulos paralelos (ver §8.4)
10. Agregar lógica auto_approved / manual_review al Router final
11. Actualizar CRM Dashboard para mostrar conversaciones flaggeadas con razones

### Fase 3 — Cola de mensajes (cambio arquitectónico, 1-2 días)

12. Crear tabla `message_queue` en Supabase:
```sql
CREATE TABLE message_queue (
  id SERIAL PRIMARY KEY,
  channel_id INT REFERENCES channels(id),
  provider_name TEXT NOT NULL,
  external_ref TEXT,
  raw_payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending / processing / completed / failed
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(provider_name, external_ref) WHERE external_ref IS NOT NULL AND external_ref != ''
);
```

13. Simplificar flujos de entrada: webhook → INSERT message_queue → respond 200
14. Nuevo flujo procesa la queue → ejecuta lógica actual del subscenario

### Fase 4 — Optimizar media (1 día)

15. Instagram: dejar de convertir a base64. Guardar URL de Meta + descargar on-demand en Media Analysis
16. Evaluar si GPT-4o-mini es suficiente para imágenes no-comprobante (ahorrar costos)
17. Reemplazar Sleep 10s por trigger en tabla `interaction_medias` (se dispara cuando media ya está guardada)

### Fase 5 — Consolidación y robustez (1 semana)

18. Agregar captura de `ad_id` en todos los flujos que reciben de Meta
19. Agregar captura de `person_name` en Instagram vía Graph API
20. Implementar merge de personas duplicadas
21. **Migrar aprobación de Google Sheet a CRM Dashboard exclusivamente** (eliminar dependencia de Sheets)
22. Agregar error handlers en TODOS los escenarios outbound (actualmente ninguno tiene)
23. Agregar `media_external_id` → columna `external_id` en tabla `medias` (Bug #9)
24. Reemplazar Sleep 60s en AI Generation por approach event-driven

### Fase 6 — Arquitectura event-driven (1-2 semanas)

25. Reemplazar todos los Sleep timers por Supabase triggers/webhooks apropiados
26. Implementar retry logic con dead-letter queue para mensajes fallidos
27. Agregar monitoreo/alertas cuando mensajes quedan en status='sending' > 5 minutos
28. Implementar versionado de system prompts con UI en CRM Dashboard

---

## 14. INVENTARIO DE ESCENARIOS

### Documentados en detalle en este archivo

| ID Make | Nombre | Tipo | Función | Sección |
|---------|--------|------|---------|---------|
| — | [INPUT] IITA Salta - Instagram | Flujo entrada | Webhooks Instagram Salta | §3.2.A |
| — | [INPUT] IITA Chatbot - WA Cloud API | Flujo entrada | Webhooks WhatsApp Cloud API | §3.2.B |
| — | [INPUT] San Lorenzo Chico - WA Coex | Flujo entrada | Eventos WhatsApp Coexistence SL | §3.2.C |
| **SCN_3730125** | Create new interaction | Subscenario | Hub central: persona+conversación+interacción | §4 |
| **SCN_3730131** | Create new conversation | Sub-subscenario | Crea conversación con CTEs atómicos | §5 |
| **SCN_3729890** | Save media into bucket | Sub-subscenario | Sube media a Storage + crea registro medias | §6 (ref) |
| — | [Prepross] Media Analisis - prod | Flujo | Analiza media con GPT-5.2/Whisper | §6 |
| — | [RG] Generate ai response - prod | Flujo | Genera respuesta AI + escribe en Sheet | §7 |
| — | Generate interactions from Google Sheets | Flujo | Aprobación vía checkbox → crea interacción saliente | §9 |
| — | Sending messages (Producción) | Flujo orquestador | Dispara dispatcher + actualiza Sheet tracking | §10.1 |
| **SCN_4124755** | IITA - Message dispatcher (Producción) | Subscenario | Routing por provider → channel → escenario outbound | §10.2 |
| **SCN_4124875** | [OUT] Whatsapp ~ Chatbot | Sub-subscenario | Envía por WA Cloud API (HTTP directo) | §10.4 |
| **SCN_4124821** | [OUT] Whatsapp ~ San Lorenzo Chico | Sub-subscenario | Envía por WA Business (módulo nativo Make) | §10.4 |
| **SCN_4124805** | [OUT] Whatsapp ~ IITA 3D | Sub-subscenario | Envía por WA Business Salta | §10.4 |
| **SCN_4124832** | [OUT] Instagram ~ Salta | Sub-subscenario | Envía por Instagram Graph API | §10.4 |
| **SCN_4124842** | [OUT] Instagram ~ San Lorenzo Chico | Sub-subscenario | Envía por Instagram Graph API SL | §10.4 |
| **SCN_4124865** | [OUT] Messenger ~ Salta | Sub-subscenario | Envía por Messenger Graph API | §10.4 |
| **SCN_4124870** | [OUT] Messenger ~ San Lorenzo Chico | Sub-subscenario | Envía por Messenger Graph API SL | §10.4 |

### Pendientes de documentar

| Carpeta/Nombre probable | Función esperada |
|------------------------|-----------------|
| Flujos de entrada restantes (6 más) | Input para otros canales WA/IG/Messenger (misma estructura, diferentes credentials) |
| 3. Analisis de conversacion - desarrollo | Posible análisis de contexto conversacional (Gustavo no satisfecho con implementación actual) |
| Configuración del agente AI en Make | Detalle de herramientas/tools disponibles para el agente "Atención al cliente" |
| CRM Dashboard (frontend) | Código React de la aplicación de gestión |

---

## NOTAS PARA REFERENCIA FUTURA DE CLAUDE

### Dónde tocar para cada tipo de mejora

| Quiero... | Tocar esto |
|----------|-----------|
| Agregar un campo nuevo al mensaje | 1) Input spec de SCN_3730125, 2) cada flujo de entrada que lo populate, 3) INSERT en los mods 11/13/15/16 del subscenario |
| Cambiar cómo se procesa un tipo de media | Mod 8 del flujo Media Analysis (agregar nueva ruta al router) |
| Cambiar el prompt de análisis de imágenes | Mod 9 del flujo Media Analysis |
| Cambiar el prompt de análisis de archivos | Mod 13 del flujo Media Analysis |
| Cambiar el system prompt de "Ana" | Actualmente: Mod 7 de "[RG] Generate ai response". Ideal: tabla `system_prompts` (ver Fase 2) |
| Agregar un nuevo canal de entrada | 1) INSERT en channels + channel_providers, 2) crear nuevo flujo de entrada, 3) asegurar que llama SCN_3730125 con el contrato correcto |
| Agregar un nuevo canal de salida | 1) Crear escenario [OUT] con patrón de 3 pasos (§10.4), 2) agregar ruta en dispatcher SCN_4124755 |
| Modificar la creación de persona | Mod 9 de SCN_3730125 |
| Modificar la creación de conversación | SQL en Mod 16 de SCN_3730131 |
| Agregar lógica post-creación de interacción | Después de los RETURN del subscenario (mods 33/35/37/39/43/46) |
| Fix de idempotencia | Mod 2 y filtro de Mod 30 de SCN_3730125 |
| Cambiar lógica de aprobación | Flujo "Generate interactions from Google Sheets" + Sheet específica |
| Agregar nuevo tipo de evaluación | Nuevo módulo paralelo en la Etapa 3.5 propuesta (§8.4) |
| Agregar error handling al envío | Error handlers en cada escenario [OUT] |

### IDs de módulos clave (para referencia rápida)

**SCN_3730125 (Create new interaction):**
- Mod 2: Check idempotencia (SELECT interactions)
- Mod 30: Buscar conversación existente + filtro
- Mod 8: Router ¿existe conversación?
- Mod 9: Crear persona nueva
- Mod 7: Call "Create new conversation"
- Mod 11/15: INSERT interaction (entrante, conv nueva/existente)
- Mod 13/16: INSERT interaction (saliente, conv nueva/existente)
- Mod 45/41: Call "Save media into bucket" (conv nueva/existente)
- Mod 48/47: INSERT interaction_medias (conv nueva/existente)

**Media Analysis:**
- Mod 2: Webhook trigger
- Mod 3: Filter status='new' + Sleep 10s
- Mod 4: Buscar media en DB
- Mod 6: Crear signed URL
- Mod 7: Descargar archivo
- Mod 9: GPT-5.2 análisis imagen
- Mod 11: Whisper transcripción audio
- Mod 13: GPT-5.2 análisis archivo/PDF

**[RG] Generate ai response:**
- Mod 2: Webhook trigger (interactions change)
- Mod 3: Filter status='preprocessed' + Sleep 60s
- Mod 4: SQL context query (últimas 10 interacciones + no respondidas)
- Mod 5: AI Agent call + deduplicación por last_interaction_id
- Mod 6: Error handler (5 retries, 15s)
- Mod 7: INSERT ai_interaction (⚠️ prompt hardcodeado aquí)
- Mod 8: Router → Sheet por sede

**Generate interactions from Google Sheets:**
- Mod 2: Watch Sheet changes (real time)
- Mod 3: Router deadline (col H=true, col I vacío, col B existe)
- Mod 4: Marca "Fuera de plazo" si > 24h
- Mod 5: CALL Create new interaction (status='pending_delivery')
- Mod 6: UPDATE ai_interaction con generated_interaction_id
- Mod 7: UPDATE Sheet (I="Pendiente", L=interaction_id)

**SCN_4124755 (Message dispatcher):**
- Mod 23: StartSubscenario (input: id_interaction)
- Mod 22: SQL query (channel info + texto)
- Mod 8: UPDATE status='sending'
- Mod 5: Router por channel_provider_id (1=WA, 2=IG, 3=Messenger, 4=WA Cloud)
- Mod 15/16/17/26: Sub-routers por channel_address específico

### Transiciones de status completas (ciclo de vida de una interacción)

```
ENTRANTE (is_user=true):
  new → preprocessed → (no más cambios, la respuesta está en ai_interaction)

SALIENTE (is_user=false):
  pending_delivery → sending → send
       │                │         │
       │                │         └─ API de plataforma confirmó entrega
       │                └─ Dispatcher tomó el mensaje
       └─ Aprobado en Sheet (o auto-approved si se implementa §8)
```

---

*Documento generado el 18 de febrero de 2026 — Actualizado con pipeline completo (Etapas 1-5)*
*Basado en análisis de blueprints JSON de Make.com + datos de Supabase*
*Proyecto Supabase: cpkzzzwncpbzexpesock (Producción)*
