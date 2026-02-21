# Diccionario de Datos — Base de Datos Legacy

Última actualización: 2026-02-21 | Validado contra datos de producción  
Cada campo fue verificado consultando contenidos reales de la base.

---

## core_persons (22,005 registros)

Tabla central de contactos. Cada persona que interactúa por cualquier canal.

| Campo | Tipo | Descripción funcional | Tasa de llenado | Valores ejemplo |
|-------|------|----------------------|-----------------|-----------------|
| `id` | bigint PK | Identificador autoincremental | 100% | 1, 2, 3... |
| `first_name` | varchar(255) | Nombre del contacto. Puede contener nombre completo si last_name está vacío | 25.5% (5,602) | "Rosana", "José David Maidana", "THE BEST" |
| `last_name` | varchar(255) | Apellido. Muy poco usado — la mayoría tiene solo first_name | 7.1% (1,572) | "Colodro" |
| `region` | varchar(255) | Región geográfica. Poblado desde importación de contactos (código de país) | 62.9% (13,846) | Código de país del teléfono |
| `birthday` | date | Fecha de nacimiento. Prácticamente sin uso | 0.2% (41) | — |
| `dni` | varchar(9) | Documento de identidad argentino | 0.5% (120) | — |
| `email` | varchar(255) | Correo electrónico | 1.0% (228) | — |
| `ignore_feedback` | boolean | Flag para excluir de procesos de feedback. Siempre false en producción | 100% (0 true) | false |
| `phone_number` | varchar(255) | Teléfono principal (formato internacional sin +). Principal identificador real | 99.9% (21,978) | "5493875108620" |

**Observaciones validadas:**
- El 74.5% de personas no tiene nombre registrado (solo teléfono).
- `first_name` a veces contiene nombre completo; `last_name` es redundante en la práctica.
- `region` se llena automáticamente desde datos de contactos importados.
- `birthday`, `dni`, `email` tienen tasas muy bajas — datos que el chatbot rara vez recopila.
- `ignore_feedback` nunca se activó en producción.

---

## core_personcomchannels (20,654 registros)

Identidad de una persona en un canal de chat. Tabla original de Django.

| Campo | Descripción funcional | Observaciones |
|-------|----------------------|---------------|
| `id` | PK autoincremental | — |
| `group_address` | Dirección de grupo (para chats grupales). Siempre vacío ("") en producción | 100% vacío |
| `address` | Identificador de la persona en el canal (número WhatsApp) | Formato "5493875XXXXXX" |
| `chat_provider_id` | FK al proveedor de chat (WhatsApp, Maytapi, etc.) | 100% tiene valor |
| `person_id` | FK a core_persons | Relación N:1 — una persona puede tener múltiples canales |
| `time_out` | Timestamp de timeout de sesión | Usado para controlar ventana de atención |

---

## core_person_channels (20,653 registros)

Versión normalizada de `core_personcomchannels`. Solo contiene datos de WhatsApp.

| Campo | Descripción funcional | Tasa de llenado |
|-------|----------------------|-----------------|
| `id` | PK autoincremental | 100% |
| `person_id` | FK a core_persons | 100% |
| `platform` | Plataforma de comunicación | 100% — solo "whatsapp" en datos reales |
| `platform_user_id` | ID de usuario en la plataforma | 0% (nunca poblado) |
| `platform_username` | Nombre de usuario en la plataforma | 0% (nunca poblado) |
| `platform_address` | Dirección/teléfono en la plataforma | 100% |
| `display_name` | Nombre visible del contacto en la plataforma | 7.6% (1,578) |
| `is_primary` | Canal principal de la persona | 100% true |
| `is_verified` | Canal verificado | 0% (todos false) |
| `original_pcc_id` | Referencia al ID original en core_personcomchannels | Trazabilidad de migración |
| `created_at` / `updated_at` | Timestamps de auditoría | 100% |

**Observaciones:** La tabla replica `core_personcomchannels` con mejor estructura pero solo WhatsApp fue migrado. Instagram y otros canales no están presentes.

---

## core_person_profile (20,613 registros)

Perfil enriquecido 1:1 con datos extraídos de conversaciones, importaciones, y minería.

| Campo | Descripción funcional | Tasa de llenado | Valores observados |
|-------|----------------------|-----------------|-------------------|
| `person_id` | PK y FK a core_persons | 100% | — |
| `localidad` | Ciudad/localidad de la persona | 78.5% (16,186) | Ciudades de Salta y Argentina |
| `provincia` | Provincia argentina | 84.5% (17,428) | "Salta", "Buenos Aires", etc. |
| `pais` | País (código corto) | 93.5% (19,277) | "AR", "BO", "CL", etc. |
| `edad_consultada` | Edad del alumno consultado | 2.1% (437) | Edades de alumnos (niños/adolescentes) |
| `consulta_para` | Para quién consulta | 3.0% (617) | "hijo" (97%), "propio" (3%) |
| `nombre_alumno` | Nombre del estudiante (si consulta para otro) | 0.6% (131) | Nombres de niños |
| `nombre_contacto` | Nombre del contacto/padre/madre | 0.6% (131) | Nombres de adultos |
| `preferencia_modalidad` | Modalidad preferida de estudio | 2.6% (533) | "online" (92%), "presencial" (5%), "ambos" (2%) |
| `es_alumno_anterior` | Si es alumno que ya cursó | 0% | Nunca poblado |
| `curso_anterior_detalle` | Detalle del curso anterior | 0% | Nunca poblado |
| `notas` | Notas adicionales | 0% | Nunca poblado |
| `source` | Origen del dato con traza combinada | 100% | Ver distribución abajo |

**Distribución de `source`:**

| Source | Cantidad | Descripción |
|--------|----------|-------------|
| `contactos_import` | 19,978 | Datos de importación de agenda WhatsApp |
| `contactos_import+chatbot_ai` | 272 | Importación + enriquecido por IA del chatbot |
| `contactos_import+edad_mining` | 164 | Importación + edad extraída de conversaciones |
| `contactos_import+chatbot_mining` | 116 | Importación + datos minados de conversaciones |
| `contactos_import+chatbot_ai+edad_mining` | 64 | Triple enriquecimiento |
| `contactos_import+chatbot_mining+edad_mining` | 17 | Triple enriquecimiento |
| `contactos_import+padre_mining` | 2 | Importación + detección de rol padre/madre |

**Observaciones:**
- El 97% de profiles se originaron en la importación de contactos.
- Los campos de mayor valor (localidad, provincia, pais) vienen de la importación.
- Los campos de conversión comercial (consulta_para, edad, modalidad) tienen baja tasa — solo se llenan cuando el chatbot AI o minería los detecta.
- `es_alumno_anterior`, `curso_anterior_detalle`, `notas` nunca fueron usados.

---

## core_interactions (80,782 registros)

Cada mensaje individual en el sistema.

| Campo | Descripción funcional | Tasa/Distribución |
|-------|----------------------|-------------------|
| `id` | PK | — |
| `provider_message_id` | ID del mensaje en la plataforma (Meta/Maytapi). Usado para deduplicación y tracking de status | 100% |
| `text` | Contenido textual del mensaje | 99.7% (80,500) |
| `timestamp` | Timestamp UTC del mensaje según el proveedor | May 2024 – Dic 2025 |
| `sender` | Quién envió el mensaje | "person" (50.8%, 41,058), "respondent" (49.2%, 39,724) |
| `conversation_id` | FK a conversación | 99.99% (80,780 de 80,782) |
| `person_id` | FK a persona. **Solo se llena para mensajes status=4 (READ)** | 42.9% (34,625) |
| `respondent_id` | FK a respondent cache. **Nunca poblado** | 0% |
| `audit_user_id` | FK al usuario que envió manualmente | 10.8% (8,693) — solo mensajes salientes manuales |
| `status` | Estado del mensaje (código numérico) | Ver distribución abajo |
| `media_id` | FK a media adjunta | 9.1% (7,351) |
| `local_timestamp` | Timestamp local (zona horaria del servidor) | 100% |
| `respond` | Flag de respuesta IA requerida | NULL=85.6%, 1=14.4% |
| `postponed` | Marcado como pendiente por operador | 99.9% false, 69 true |

**Distribución de `status`:**

| Status | Cantidad | Significado |
|--------|----------|-------------|
| 4 | 34,625 (42.9%) | **READ** — mensaje leído por destinatario |
| 3 | 34,396 (42.6%) | **RECEIVED** — mensaje recibido (entregado) |
| 5 | 11,608 (14.4%) | **FAILED** — envío fallido |
| 2 | 110 (0.1%) | **SENT** — enviado pero sin confirmación de recepción |
| 1 | 43 (0.05%) | **TO_SEND** — pendiente de envío |

**Observaciones:**
- `person_id` NO es una FK confiable para "quién envió" — se llena solo en ciertos status. Para saber quién envió, usar `sender`.
- `respondent_id` nunca tiene valor pese a existir como FK. La relación con respondent se rastrea a través de conversation → respondent_id.
- El 14.4% de status FAILED es significativo — probablemente ventanas de 24h de WhatsApp expiradas.
- Solo 69 mensajes marcados como postponed.

---

## core_conversations (22,423 registros)

| Campo | Descripción | Observaciones |
|-------|-------------|---------------|
| `id` | PK | — |
| `result` | Resultado de la conversación | **Siempre NULL** — campo diseñado pero no implementado |
| `start` | Inicio de conversación | May 2024 – Dic 2025 |
| `end` | Fin de conversación | **Siempre NULL** — las conversaciones nunca se cierran |
| `company_com_channel_id` | Canal de empresa por el que se comunicó | FK a core_companycomchannels |
| `person_com_channel_id` | Canal de persona | FK a core_personcomchannels |
| `respondent_id` | Respondent IA asignado | FK a core_respondentcache |

**Observaciones:** `result` y `end` nunca se usan. Las conversaciones se abren y nunca se cierran formalmente.

---

## core_aiinteractions (20,615 registros)

| Campo | Descripción | Observaciones |
|-------|-------------|---------------|
| `text` | Texto sugerido por la IA | Siempre poblado |
| `media` | Media sugerida (path) | Campo varchar, no FK a core_media |
| `acepted` | Si fue aceptada (typo: debería ser "accepted") | **100% true** — todo se marca como aceptado |
| `conversation_id` | FK a conversación | 99.99% poblado |
| `final_interaction_id` | FK a la interacción final enviada | 17.8% (3,675) — solo cuando se envió efectivamente |
| `timestamp` | Momento de generación | — |
| `log_entry_id` | FK 1:1 al log detallado | 33.1% (6,826) — no todas tienen log |
| `failed` | Si la generación falló | 66.9% (13,789) tienen failed=true |

**Observaciones:**
- `acepted` es siempre true, lo cual sugiere que el campo se setea automáticamente, no refleja aceptación manual real.
- 66.9% de registros tienen `failed=true`, lo que indica que la mayoría de los intentos de IA fallaron (probablemente rate limits, errores de API, o respuestas inválidas).
- Solo 17.8% se vinculan a una interacción final enviada, consistente con la alta tasa de falla.

---

## core_aiinteractionlog (22,981 registros)

| Campo | Descripción | Observaciones |
|-------|-------------|---------------|
| `final_text` | Texto final enviado (puede diferir del sugerido) | 100% poblado |
| `final_media` | Media final | 100% poblado (puede ser string vacío) |
| `ai_text` | Texto original sugerido por IA | 100% |
| `edited_by_human` | Si un operador editó el texto | 9.3% (2,145) |
| `rating` | Calificación del operador (1-5) | 15.7% (3,611) |
| `feedback` | Comentario del operador | 15.7% (3,611) |
| `prompt` | Prompt system completo enviado a la IA | 100% — campos de texto extenso |
| `request` | Request completo a la API | 100% — campos de texto extenso |
| `ai_media` | Media en respuesta IA | 100% poblado (puede ser string vacío) |
| `ai_model` | Modelo usado | Ver distribución abajo |
| `ai_provider` | Proveedor usado | 100% "openai" |

**Distribución de modelos:**

| Modelo | Uso | Período estimado |
|--------|-----|-----------------|
| gpt-4o | 12,014 (52.3%) | Principal modelo de producción |
| gpt-4.1 | 5,211 (22.7%) | Upgrade posterior |
| gpt-3.5-turbo | 4,095 (17.8%) | Modelo inicial/económico |
| ft:gpt-4o-mini (v2) | 1,283 (5.6%) | Fine-tuned con datos simulados |
| ft:gpt-4o-mini (v1) | 378 (1.6%) | Fine-tuned primera versión |

**Observaciones:**
- Hay más logs (22,981) que AI interactions (20,615) porque los logs son inmutables — cada intento genera un log, pero la AI interaction puede actualizarse o recrearse.
- Solo 9.3% de respuestas fueron editadas por humano antes de enviar.
- 15.7% recibieron rating y feedback — buen dataset para entrenamiento/evaluación.
- **Alerta de tamaño:** Esta tabla ocupa 572 MB (558 MB TOAST) debido a los campos prompt y request que contienen texto extenso.

---

## core_tags (31 registros)

Catálogo normalizado post-migración.

| tag_type | Cantidad | Descripción |
|----------|----------|-------------|
| `curso_interes` | 26 | Interés en un curso específico (puede vincular a core_courses via course_id) |
| `operativa` | 2 | Etiquetas operativas ("A responder Cecilia", "Dev") |
| `difusion` | 3 | Campañas de difusión masiva |

**Vinculación con cursos:** 16 de 26 tags de curso_interes tienen `course_id` apuntando a core_courses. Los restantes 10 son genéricos o sin curso definido.

---

## core_person_tags (16,782 registros)

| source | Cantidad | Descripción |
|--------|----------|-------------|
| `legacy_migration` | 8,870 (52.9%) | Migrado desde core_personbyinterest |
| `chatbot_ai_fix` | 5,184 (30.9%) | Corregido/reasignado por IA |
| `chatbot_ai` | 1,247 (7.4%) | Asignado por IA del chatbot |
| `contactos_import` | 1,006 (6.0%) | Desde importación de contactos |
| `manual` | 340 (2.0%) | Asignación manual |
| `contactos_es_negocio` | 135 (0.8%) | Detectado como negocio en contactos |

---

## core_interests (36 registros)

Catálogo original de etiquetas de Django. Mezcla intereses genuinos (cursos) con etiquetas operativas y campañas de difusión.

| Tipo de interés | Ejemplos | Observaciones |
|-----------------|----------|---------------|
| Cursos (ids 1-11) | "Python online", "robotica educativa", "Videojuegos presencial" | Los intereses originales |
| Operativas (ids 12, 23) | "a responder cecilia", "dev" | Etiquetas de workflow |
| Cursos agregados (ids 13-22) | "fusion 360 presencial", "cursos impresión 3d" | Agregados más adelante |
| Difusión (ids 24-36) | "Diffusion_2025-06-23", "PYTHON ONLINE" | Campañas de WhatsApp masivo |

**Observaciones:** Hay duplicados de nombre (ej. tres "Blender presencial recordatorio 25-6" con ids 25, 26, 27). Esta desestructuración motivó la creación de `core_tags`.

---

## core_media (7,366 registros)

| Mimetype | Cantidad | % |
|----------|----------|---|
| video/mp4 | 3,618 | 49.1% |
| application/pdf | 1,321 | 17.9% |
| image/jpeg | 1,227 | 16.7% |
| audio/ogg; codecs=opus | 912 | 12.4% |
| docx | 145 | 2.0% |
| audio/mpeg | 56 | 0.8% |
| image/webp | 52 | 0.7% |
| Otros (png, python, csv, sql, etc.) | 35 | 0.5% |

> `content` es un campo varchar(100) que almacena la ruta relativa al archivo en el sistema de archivos del servidor Django (no base64 ni URL pública).

---

## contactos (13,845 registros)

Importación directa de agenda de WhatsApp. PK es el número de teléfono.

| Campo | Descripción | Tasa |
|-------|-------------|------|
| `cod_pais` | Código de país | 100% |
| `nom_pais` | Nombre corto de país (2 letras) | 100% |
| `num_tel` | Número de teléfono (**PK**) | 100% |
| `tel_form` | Teléfono formateado | 100% |
| `es_contacto` | Si está en la agenda | 7.6% (1,056 true) |
| `nom_agendado` | Nombre como está agendado | 11.2% (1,557) |
| `nom_publico` | Nombre público de WhatsApp | 11.2% (1,557) |
| `es_negocio` | Si es cuenta de WhatsApp Business | 1.0% (135 true) |
| `es_admin` | Si es cuenta admin | 0% (todos false) |
| `etiquetas` | Etiquetas en texto libre | 100% (puede ser string vacío) |
| `fecha_carga` | Fecha de importación | default CURRENT_DATE |
| `tel_carga` | Teléfono desde el que se cargó | 100% |

---

## core_companycomchannels (9 registros)

Canales de comunicación de la empresa (IITA).

| ID | Nombre | Proveedor | Address | Sucursal |
|----|--------|-----------|---------|----------|
| 1 | (sin nombre) | whatsapp | 326139457242025 | IITA Centro |
| 2 | IITA WhatsApp oficial | whatsapp | 100436536473788 | IITA Centro |
| 4 | IITA Administración | whatsapp_maytapi | 5493872550001 | IITA Centro |
| 5 | (sin nombre) | whatsapp | 356883977229565 | IITA Centro |
| 6 | IITA Cursos | whatsapp_maytapi | 5493875809351 | IITA Centro |
| 7 | IITA San Lorenzo | whatsapp_maytapi | 5493876844174 | IITA Centro |
| 9 | WhatsApp Coexistence - IITA3D | whatsapp | 109900548507307 | IITA Centro |
| 10 | IITA 3d | whatsapp_coexistence | 105728648930541 | IITA Centro |
| 12 | IITA - San Lorezo | whatsapp_coexistence - SanLorenzo | 102522002867267 | IITA Centro |

> **Nota:** Todos asignados a branch_id=1 (IITA Centro) aunque el canal 12 es "San Lorenzo" — branch_id incorrecto en datos.

---

## core_courseedition (43 registros)

| Status | Cantidad |
|--------|----------|
| ACTIVE | Mayoría |
| CONCLUDE | Algunos finalizados |

**Valores de class_day:** LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO (en español, uppercase).  
**min_age/max_age:** Solo para Robótica Educativa (6-8, 9-13).  
**Cursos con ediciones:** Robótica Educativa (más ediciones), Marketing Digital, Videojuegos, Python, etc.

---

## Tablas vacías o sin uso real

| Tabla | Registros | Observación |
|-------|-----------|-------------|
| core_lead_inquiry | 0 | Diseñada pero nunca usada |
| core_companiesdata | 0 | Sin datos |
| core_empleado | 0 | Sin datos |
| core_limit | 0 | Sin datos |
| core_rol | 0 | Sin datos |
| auth_group | 0 | Sin grupos definidos |
