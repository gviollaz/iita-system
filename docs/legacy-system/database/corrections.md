# Correcciones a Documentación Previa — Base de Datos Legacy

Última actualización: 2026-02-21  
Documento base corregido: `chatbot-v2-documentacion-completa.md` (análisis desde código)  
Método de validación: queries directas contra datos de producción (backup en `kdwdknuhowdehknztark`)

---

## Resumen

La documentación existente (`chatbot-v2-documentacion-completa.md`) fue generada a partir del **código fuente** del chatbot legacy. Este documento registra las correcciones y precisiones obtenidas al validar contra los **datos reales** de producción (~440K registros, 680 MB).

---

## 1. Conteo de tablas

**Documentación previa:** Menciona modelos del ORM Django sin contar tablas reales.  
**Dato real:** La base tiene **41 tablas** en el schema `public`, organizadas en:

| Dominio | Tablas | Registros |
|---------|--------|-----------|
| Personas (original + normalizado) | 7 | ~123,000 |
| Conversaciones y mensajes | 5 | ~226,000 |
| Etiquetas (dual: legacy + normalizado) | 4 | ~25,700 |
| Cursos | 2 | 17 |
| IA | 8 | ~64,500 |
| Empresa, canales, config | 8 | ~50 |
| Django admin/auth | 7 | ~80 |

Tablas no mencionadas en la documentación de código:
- `contactos` (13,845 registros — importación de agenda WhatsApp, externa a Django ORM)
- `core_person_channels` (20,653 registros — normalización post-migración)
- `core_person_profile` (20,613 registros — perfiles enriquecidos 1:1)
- `core_person_tags` (16,782 registros — sistema de etiquetas normalizado)
- `core_tags` (31 registros — catálogo de etiquetas tipificadas)
- `core_lead_inquiry` (0 registros — diseñada pero nunca usada)

---

## 2. Conversations: `end` y `result` nunca se usan

**Documentación previa:** _"Conversations agrupa interacciones por par (company_channel, person_channel) mientras `end` sea NULL"_ — implica que las conversaciones se cierran eventualmente.  
**Dato real:** `end` es **siempre NULL** en los 22,423 registros. `result` también es **siempre NULL**. Las conversaciones se abren pero **nunca se cierran formalmente**. El sistema funciona con conversaciones perpetuamente abiertas, una por par canal-empresa / canal-persona.

---

## 3. `Interactions.person_id` es parcial, no confiable como FK

**Documentación previa:** `Interactions` tiene FK a `Persons` (person_id), listada como campo del modelo.  
**Dato real:** `person_id` solo se llena cuando `status = READ` (42.9% de registros). En el 57.1% restante, `person_id` es NULL. **No debe usarse como FK confiable** para determinar quién envió el mensaje. El remitente se determina por el campo `sender` ('person' o 'respondent') combinado con el contexto de la conversación.

---

## 4. `Interactions.respondent_id` nunca se usa

**Documentación previa:** No menciona este campo explícitamente en el modelo, pero la FK existe.  
**Dato real:** El campo `respondent_id` (FK a `auth_user`) existe en el esquema pero es **NULL en el 100% de los registros** (80,782). El respondent no se trackea a nivel de interacción sino a nivel de conversación (vía `core_conversations.respondent_id` → `core_respondentcache`).

---

## 5. `AIInteractions.acepted` siempre es true

**Documentación previa:** _"AIInteractions registra sugerencias IA, aceptación/edición"_ — implica que `acepted` refleja si el operador aceptó la sugerencia.  
**Dato real:** 
- El campo tiene un **typo**: `acepted` (no `accepted`).
- Su valor es **true en el 100% de los 20,615 registros**.
- No refleja aceptación real del operador; se setea automáticamente al crear la sugerencia.
- El tracking real de aceptación/edición está en `core_aiinteractionlog.edited_by_human`.

---

## 6. Tasa de fallo de IA: 66.9%

**Documentación previa:** No cuantifica fallos de IA.  
**Dato real:** De 20,615 sugerencias IA, **13,789 (66.9%) tienen `failed = true`**. Solo 6,826 (33.1%) fueron exitosas, y de esas, solo **3,675 (17.8% del total) llegaron a enviarse** como interacción final. Las causas probables incluyen rate limits de OpenAI, errores de parsing, y timeouts.

---

## 7. Evolución de modelos IA

**Documentación previa:** Menciona OpenAI genéricamente.  
**Dato real:** Hay trazabilidad completa de modelos usados:

| Modelo | Registros | % | Período estimado |
|--------|-----------|---|------------------|
| gpt-3.5-turbo | 4,095 | 17.8% | Fase inicial (2024) |
| gpt-4o | 12,014 | 52.3% | Fase principal |
| gpt-4.1 | 5,211 | 22.7% | Fase reciente (2025) |
| ft:gpt-4o-mini-2024-07-18 (v1) | 1,205 | 5.2% | Experimento fine-tuning |
| ft:gpt-4o-mini-2024-07-18 (v2) | 456 | 2.0% | Segundo fine-tuning |

El sistema evolucionó activamente entre al menos 5 modelos diferentes, incluyendo experimentos de fine-tuning.

---

## 8. Instagram: sin datos en producción

**Documentación previa:** _"integración con Instagram"_ — lista el adaptador `instagram.py` como funcional.  
**Dato real:** El proveedor `instagram` existe en `core_chatproviders` pero **no hay ningún `core_companycomchannels` asociado**, y por tanto **cero conversaciones o mensajes de Instagram** en la base. La integración existía en código pero nunca fue desplegada en producción.

---

## 9. Proveedores de chat: detalle real

**Documentación previa:** Lista genérica de proveedores.  
**Dato real:** 9 canales activos configurados:

| ID | Proveedor | Canal | Sucursal |
|----|-----------|-------|----------|
| 1 | whatsapp (Meta Cloud API) | IITA Consultas | Centro |
| 2 | whatsapp | IITA Portafolio | Centro |
| 3 | whatsapp | IITA Cursos | Centro |
| 4 | whatsapp_maytapi | IITA Gus | Centro |
| 5 | whatsapp_maytapi | IITA Lu | Centro |
| 6 | whatsapp_maytapi | IITA Jose | Centro |
| 7 | whatsapp | IITA San Lorenzo | Centro ⚠️ |
| 11 | whatsapp_coexistence | IITA 3D | Centro |
| 12 | whatsapp_coexistence | IITA - San Lorenzo | Centro ⚠️ |

**Error detectado:** Los canales de San Lorenzo (IDs 7 y 12) apuntan a `branch_id = 1` (IITA Centro) en lugar de `branch_id = 2` (IITA San Lorenzo Chico). Esto es un **bug de datos** que afecta reportes por sucursal.

---

## 10. Campos `Interactions.respond` y `Interactions.postponed`

**Documentación previa:** _"`Interactions.respond` se usa para filtrar generación IA"_ y _"marcado pendiente (postponed)"_.  
**Dato real:**
- `respond`: valores encontrados son 0 (mayoría) y 1. Usado por el motor async para determinar si la IA ya procesó un mensaje, pero no es visible en la UI.
- `postponed`: boolean. Se usa en la UI como filtro "pendientes" en la lista de chats. Ambos campos funcionan como documentado.

---

## 11. core_aiinteractionlog: problema de tamaño

**Documentación previa:** _"Se guardan logs IA (prompt y request) en DB, lo cual es buenísimo para auditoría"_.  
**Dato real:** La tabla tiene solo 22,981 registros pero ocupa **572 MB** (14 MB datos + 558 MB TOAST overhead). Los campos `prompt` y `request` almacenan textos extensos (prompts system completos, requests JSON grandes). Esto representa el **84% del tamaño total de la base** en una sola tabla.

---

## 12. `Interactions.status`: códigos numéricos reales

**Documentación previa:** Menciona "TO_SEND/SENT/RECEIVED/READ/FAILED" como nombres.  
**Dato real:** Los valores almacenados son **enteros**, no strings:

| Valor | Significado | Registros | % |
|-------|-------------|-----------|---|
| 1 | TO_SEND | 43 | 0.05% |
| 2 | SENT | 110 | 0.1% |
| 3 | RECEIVED | 34,396 | 42.6% |
| 4 | READ | 34,625 | 42.9% |
| 5 | FAILED | 11,608 | 14.4% |

El 14.4% de mensajes con status FAILED es un hallazgo significativo no mencionado en la documentación original.

---

## 13. core_interests tiene duplicados

**Documentación previa:** No menciona problemas de calidad en interests.  
**Dato real:** Hay **36 registros en core_interests** con nombres duplicados. Ejemplo: "Blender presencial recordatorio 25-6" aparece con IDs diferentes. Algunos interests fueron creados como etiquetas de campaña de difusión (patrón "Diffusion_YYYY-MM-DD" o "recordatorio") mezclados con intereses genuinos de cursos.

---

## 14. Sistema dual de etiquetas no documentado

**Documentación previa:** Solo documenta `core_interests` + `core_personbyinterest`.  
**Dato real:** Coexisten dos sistemas paralelos:

| Aspecto | Legacy | Normalizado |
|---------|--------|-------------|
| Catálogo | `core_interests` (36 items, sin tipificar) | `core_tags` (31 items, con `tag_type`, `modality`, `course_id`) |
| Relación | `core_personbyinterest` (8,873 asignaciones) | `core_person_tags` (16,782 asignaciones, con `source` y `confidence`) |
| Trazabilidad | Sin metadata | `source`: legacy_migration (52.9%), chatbot_ai_fix (30.9%), etc. |

La migración al sistema normalizado **no reemplazó** el legacy sino que coexiste. Los datos se duplicaron y enriquecieron.

---

## 15. `core_person_profile`: datos de conversión comercial

**Documentación previa:** No existe referencia a esta tabla ni a sus datos.  
**Dato real:** 20,613 registros con perfiles enriquecidos. Hallazgos:
- `source`: 96.9% son `contactos_import` (importación de agenda), solo 3% enriquecidos por chatbot
- `consulta_para`: 97% responde "hijo" (padres buscando cursos para hijos)
- `preferencia_modalidad`: 92% prefiere "online"
- `pais`: 99.8% Argentina (donde tiene datos)
- `provincia`: 95% Salta

---

## 16. Tabla `contactos` no documentada

**Documentación previa:** No existe referencia.  
**Dato real:** 13,845 registros de importación de agenda WhatsApp. Campos incluyen: `numero_telefono`, `nombre_contacto`, `es_contacto` (7.6%), `es_negocio` (1%), `hora_contacto`, `profile_picture_url`. Esta tabla es externa al ORM Django (no tiene modelo Django) y fue usada como fuente para popular `core_persons` y `core_person_profile`.

---

## 17. Media: distribución real de tipos

**Documentación previa:** Menciona soporte de media genéricamente.  
**Dato real:** 7,366 archivos media con distribución:
- 49.1% videos (mp4) — inusualmente alto, probablemente material educativo
- 17.9% PDFs
- 16.7% imágenes (jpeg)
- 12.4% audio (ogg/opus — mensajes de voz WhatsApp)
- 2.0% documentos Word
- 1.9% otros

Solo 9.1% de mensajes incluyen adjuntos.

---

## 18. RLS habilitado en 5 tablas normalizadas

**Documentación previa:** No menciona Row Level Security.  
**Dato real:** Las tablas normalizadas agregadas post-migración tienen RLS habilitado:
- `core_person_channels`
- `core_person_profile`
- `core_person_tags`
- `core_tags`
- `core_lead_inquiry`

Las 36 tablas Django originales **no tienen RLS**. Esto es consistente con que las tablas normalizadas fueron creadas pensando en acceso vía Supabase (que requiere RLS para seguridad).

---

## 19. Tablas vacías diseñadas pero no implementadas

**Documentación previa:** Menciona `CompaniesData` como "archivos/datos asociados a empresa (no muy usados)".  
**Dato real:** Las siguientes tablas están **completamente vacías** (0 registros):

| Tabla | Propósito aparente |
|-------|-------------------|
| `core_companiesdata` | Datos/archivos de empresa |
| `core_empleado` | Registro de empleados |
| `core_limit` | Límites configurables |
| `core_rol` | Roles del sistema |
| `core_lead_inquiry` | Tracking comercial de consultas |

Estas tablas representan funcionalidades diseñadas en el esquema pero nunca implementadas en la lógica de negocio.

---

## Nota final

Las correcciones en este documento no invalidan la documentación de código existente. `chatbot-v2-documentacion-completa.md` sigue siendo la referencia correcta para la **arquitectura de software** (flujos, APIs, módulos). Este documento complementa con la **realidad de los datos** en producción, que a veces diverge de lo que el código sugiere.
