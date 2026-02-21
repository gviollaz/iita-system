# IITA CRM — Changelog

---

## [2026-02-20 noche] — Reglas de media para IA, fix echo duplicados, fix truncamiento

**Estado: APLICADO EN PRODUCCION (DB) + PENDIENTE DEPLOY (frontend) + PENDIENTE APLICAR (Make.com)**

### Propuesta 1 Nivel 1: Reglas de media en system prompt de Ana

**Problema validado con datos:**
- Tasa de rechazo IA en mensajes con media adjunta: **29.5%** (13/44)
- Tasa de rechazo IA en mensajes sin media: **0.5%** (57/12,314)
- **59x mas rechazos** cuando hay media — Ana se sale de personaje para opinar sobre contenido externo

**Caso ejemplar:** Cliente envio capturas del perfil de Elon Musk en X (crypto). Ana respondio con advertencias de phishing en vez de preguntar por cursos. Evaluacion: `confictive`.

**Desglose por tipo de media:**
| Categoria | Rechazos | Tasa |
|-----------|----------|------|
| Imagen analizada (jpeg con GPT) | 4/8 | 50% |
| Audio transcrito (ogg) | 5/7 | 71% |
| No analizable (mp4, html) | 4/9 | 44% |
| Sin descripcion (media vieja) | 0/19 | 0% |

**Causa raiz:** El system prompt de Ana no tiene reglas para manejar media off-topic. GPT-5.2 describe la imagen correctamente, pero Ana no sabe que debe ignorar contenido externo.

**Solucion:** Nueva seccion "Manejo de imagenes, archivos y audios adjuntos" con 6 reglas + REGLA DE ORO. Texto completo en `docs/SYSTEM-PROMPT-ANA-COMPLETO.md`.

**Donde aplicar:**
1. **Make.com → AI Agent** "Atencion al cliente y asesor de cursos (Activo)" (agent ID `d5568d5f-072d-410a-8c60-2cc48e944525`) — editar instrucciones del agente
2. **Escenario 4132827 → Modulo 7** — actualizar copia hardcodeada del system_prompt en campo `@system_prompt`

**Estado:** ⏳ Texto listo, pendiente aplicar manualmente en Make.com.

**Metrica de exito:** Tasa de rechazo en media < 10% (monitorear 1 semana post-implementacion).

---

### Fix: Race condition en trigger de prevencion de ecos

**Bug:** 23 mensajes duplicados nuevos aparecian en el chat. El trigger `prevent_echo_interaction` (Guard 2) solo buscaba status `send`, pero cuando el eco de Instagram llega (~1s despues), la interaccion original todavia esta en `pending_delivery` — el dispatcher aun no la actualizo.

**Secuencia de la race condition:**
```
T+0.0s: approve_ai_response → crea interaccion con status 'pending_delivery'
T+0.5s: Make.com dispatcher envia a Instagram
T+1.2s: Instagram devuelve echo → trigger busca status='send' → NO ENCUENTRA → echo se inserta
T+1.5s: Dispatcher actualiza status a 'send' → TARDE, echo ya entro
```

**Migracion:** `fix_echo_trigger_race_condition`
- Guard 2 cambiado de `AND status = 'send'` a `AND status IN ('send', 'pending_delivery', 'sending')`
- Esto cubre todos los estados intermedios del envio

**Limpieza:** 23 ecos duplicados eliminados (todos sin dependencias en ai_interaction ni interaction_medias).

**Verificacion:** 0 duplicados restantes post-limpieza.

---

### Fix: Respuestas IA truncadas a 400 caracteres

**Bug:** En el panel de aprobacion de respuestas IA, el texto se cortaba a 400 caracteres con "..." al final. Respuestas largas no se podian leer completas antes de aprobar.

**Causa:** `Conversations.jsx` linea 567:
```javascript
// ANTES:
{(ai.response || '').slice(0, 400)}{ai.response?.length > 400 ? '...' : ''}
// DESPUES:
{ai.response || ''}
```

**Fix:** Se elimino el `.slice(0, 400)` y se agrego `whiteSpace: 'pre-wrap'` + `wordBreak: 'break-word'` para mostrar el texto completo con formato correcto.

**Archivo:** `src/pages/Conversations.jsx`
**Estado:** ⏳ Pendiente deploy (requiere `npm run build`).

---

## [2026-02-20 tarde] — Fix search_path, enriquecimiento automatizado

**Estado: APLICADO EN PRODUCCION**

### Fix: search_path en 16 funciones PostgreSQL (Propuesta 5 — COMPLETADA)

**Problema:** 16 funciones en el schema `public` no tenian `search_path` fijado, lo que las hacia vulnerables a inyeccion de schema (Supabase Advisory `0011_function_search_path_mutable`). Las funciones con `SECURITY DEFINER` eran las mas expuestas.

**Auditoria pre-implementacion:**
- Se verifico el codigo fuente de las 16 funciones: **ninguna accede a schemas externos** (vault, extensions, auth, cron, pg_net) — todas operan exclusivamente sobre tablas del schema `public`
- Se confirmo que `ALTER FUNCTION ... SET search_path` es no-bloqueante (modifica catalogo `pg_proc`, no recrea la funcion)
- Se verificaron las 2 funciones de trigger en produccion real (procesan ~100+ mensajes/dia)

**Migracion:** `fix_search_path_16_functions`

| Grupo | Funciones | Security | Riesgo |
|-------|-----------|----------|--------|
| RPCs Dashboard | `get_crm_stats`, `get_msgs_per_day`, `get_volume_by_channel`, `get_volume_by_provider`, `get_top_leads`, `get_unanswered_conversations`, `get_channel_analysis` | DEFINER | Bajo |
| RPCs Personas | `get_person_detail`, `get_persons_enriched`, `get_persons_filter_options`, `search_persons` | DEFINER | Bajo |
| RPCs Chat/Utility | `get_conversations`, `get_person_full_profile`, `find_or_create_conversation` | INVOKER | Bajo |
| Triggers | `prevent_duplicate_conversation`, `update_conversation_last_activity` | INVOKER | Bajo |

**Verificacion post-implementacion:**
- 0 funciones publicas sin search_path fijado (antes: 16)
- 0 advisories `function_search_path_mutable` (antes: 16)
- 15/16 funciones testeadas OK; `get_volume_by_provider` tiene timeout pre-existente (problema de performance, no del fix)
- Triggers funcionando: `last_activity_at` sincronizado, anti-duplicados activo

**Score de seguridad resultante:**
| Advisory | Antes | Despues |
|----------|-------|---------|
| `function_search_path_mutable` | 16 | **0** |
| `rls_policy_always_true` | 30 | 30 (requiere RBAC, Fase 4) |
| `auth_leaked_password_protection` | 1 | 1 (requiere config Auth) |
| Indices no usados | 15 | 16 (se agrego 1 del enrichment) |

---

### Enriquecimiento automatizado con pg_cron + Edge Function

**Objetivo:** Automatizar el analisis de conversaciones de las 25K personas usando IA, sin depender de ejecucion manual de scripts.

**Infraestructura implementada:**
- **Edge Function `enrich-persons` v2:** Recibe `batch_size`, consulta personas pendientes via `get_persons_for_analysis()`, llama a OpenAI gpt-4o-mini, guarda resultados en `person_soft_data`
- **pg_cron job `enrich-persons-batch`:** Ejecuta cada 55 segundos, llama a la EF via `pg_net.http_post`
- **Funciones auxiliares:** `pause_enrichment_cron()`, `resume_enrichment_cron()` para control operativo
- **Secrets en Vault:** `project_url` y `anon_key` almacenados en `vault.decrypted_secrets`

**Configuracion actual:**
- Batch size: **12 personas** por ejecucion (ajustado desde 5 inicial, probado con 20 — muy cerca del timeout)
- Intervalo: 55 segundos
- Timeout: 50,000 ms
- Ritmo: ~785 personas/hora

**Progreso al 20-feb-2026 18:45 UTC:**
| Metrica | Valor |
|---------|-------|
| Total personas | 25,360 |
| Analizadas (`_ia_analysis_meta`) | 2,148 (8.5%) |
| Con datos extraidos | 1,963 (91.4% de analizadas) |
| Sin datos extraibles | 185 (8.6%) |
| Pendientes | ~23,212 |
| Estimado restante | ~29 horas |

**Datos extraidos (27 tipos):**
- Geograficos: `pais` (82%), `provincia` (68%), `localidad` (63%)
- Comerciales: `tag_curso_interes` (55%)
- Demograficos: `consulta_para`, `edad_consultada`, `pref_modalidad`, `tiene_hijos`, etc. (<7%)

---

## [2026-02-20] — Fix media, prevencion de ecos, limpieza de datos

**Estado: ✅ APLICADO EN PRODUCCION (migraciones DB)**

### Fix: Visualizaci&oacute;n de im&aacute;genes y videos en el chat

**Bug:** Ninguna imagen ni video se mostraba en el panel de chat del CRM. Aparec&iacute;an como links rotos o no se renderizaban.

**Causa ra&iacute;z (2 bugs encadenados):**

| # | Bug | Ubicaci&oacute;n |
|---|-----|-----------|
| 1 | Frontend usa `med.url` pero la RPC retornaba `med.content_dir` | `get_chat_detail` &rarr; `Conversations.jsx` |
| 2 | `content_dir` es un path relativo de Storage (`media/interaction_medias/...`) no una URL completa | tabla `medias` |

**Cadena del problema:**
```
medias.content_dir = "media/interaction_medias/interaction_media_102573 (1).jpeg"
         &darr;
get_chat_detail() retorna { content_dir: "media/..." }  (no tiene campo 'url')
         &darr;
Conversations.jsx: if (isImage(med.type) && med.url)  &rarr; med.url = undefined &rarr; false
         &darr;
Imagen nunca se renderiza. Lightbox tambi&eacute;n recibe src=undefined &rarr; return null
```

**Fix aplicado:** Migraci&oacute;n `fix_media_url_in_get_chat_detail`
- Se modific&oacute; la funci&oacute;n RPC `get_chat_detail` para agregar un campo `url` computado
- Si `content_dir` empieza con `http` &rarr; se retorna tal cual
- Si es un path de Storage &rarr; se construye la URL p&uacute;blica completa: `https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/object/public/{content_dir}`
- Espacios en nombres de archivo se encodean como `%20`
- Tambi&eacute;n se fij&oacute; `search_path = public` (resuelve 1 advisory de seguridad)
- **No se toc&oacute; el frontend** &mdash; el fix es 100% server-side

**Verificaci&oacute;n:**
- Los 57 registros de media son paths de Supabase Storage (bucket `media`, p&uacute;blico)
- URL generada probada y accesible (HTTP 200, retorna imagen JPEG v&aacute;lida)
- No hay registros con base64 (todos migrados a Storage previamente)

```sql
-- Verificar que las URLs se generan correctamente
SELECT (get_chat_detail(25931))::json->'media' as media_con_url;
-- Debe incluir campo "url": "https://cpkzzzwncpbzexpesock.supabase.co/storage/v1/object/public/..."
```

---

### Fix: Prevenci&oacute;n de interacciones eco (duplicados de Instagram/WhatsApp)

**Bug:** Cuando el sistema enviaba una respuesta por Instagram, el webhook de Instagram reenviaba el mismo mensaje como eco ~1 segundo despu&eacute;s. Make.com lo insertaba como nueva interacci&oacute;n `preprocessed`, generando duplicados visibles en el chat.

**An&aacute;lisis de magnitud:**
- 156 pares eco detectados (interacci&oacute;n `send` seguida de `preprocessed` con texto id&eacute;ntico en &lt;60s)
- 281 `external_ref` duplicados
- ~25,500 registros con `external_ref` basura (`''` o `'2'`)

**Fix aplicado:** Migraciones `add_echo_prevention_trigger` + `add_external_ref_dedup_to_echo_trigger`

Se cre&oacute; un trigger `prevent_echo_interaction()` en la tabla `interactions` con 2 guardas:

```sql
-- Guarda 1: Duplicado de external_ref (bloquea si length > 10 y ya existe)
-- Guarda 2: Eco de mensaje (bloquea si texto id&eacute;ntico a un 'send' en <60s en mismo system_conversation)
```

**Consideraciones de dise&ntilde;o (cr&iacute;ticas):**
- **Respuestas humanas desde Instagram/Meta Business Suite:** SE SIGUEN GUARDANDO. El trigger solo bloquea ecos (texto id&eacute;ntico a un mensaje `send` reciente), no respuestas nuevas de operadores humanos.
- **Campa&ntilde;as masivas:** NO se afectan. Los mensajes id&eacute;nticos a m&uacute;ltiples leads van por diferentes `system_conversation`, as&iacute; que el trigger no los detecta como eco.
- **Ventana de eco:** 60 segundos. Si un eco llega despu&eacute;s de 60s, no se bloquea (caso extremo improbable).

---

### Limpieza de datos duplicados existentes

**Acciones ejecutadas:**
- Eliminados **156 registros** de eco (sin dependencias en `ai_interaction` ni `interaction_medias`)
- Eliminados **179 registros** con `external_ref` duplicado (sin dependencias)
- **107 registros** con dependencias NO se tocaron (tienen `ai_interaction` o media asociada)

```sql
-- Verificar estado post-limpieza
SELECT COUNT(*) FROM interactions i
WHERE EXISTS (
  SELECT 1 FROM interactions i2
  WHERE i2.external_ref = i.external_ref AND i2.id != i.id
  AND LENGTH(i.external_ref) > 10
);
```

---

### Proceso de enriquecimiento de personas (en curso)

**Objetivo:** Analizar conversaciones de cada persona usando IA (OpenAI gpt-4o-mini) para extraer datos como nombre, email, edad, inter&eacute;s en cursos, etc. y guardarlos en `person_soft_data`.

**Infraestructura creada:**
- Migraci&oacute;n `create_person_enrichment_log`: Tabla de tracking con estado por persona
- Migraci&oacute;n `create_get_persons_for_analysis`: Funci&oacute;n RPC que retorna personas pendientes (con &ge;3 interacciones, no procesadas a&uacute;n)
- Script `scripts/analyze-conversations.mjs`: Cliente multi-proveedor (OpenAI/Gemini/Claude)

**Progreso al 20-feb-2026:**
| Lote | Cantidad | Estado |
|------|----------|--------|
| 1 (prueba) | 100 | ✅ Completado |
| 2 | 500 | ✅ Completado |
| 3 | 500 | ✅ Completado (880 ok, 3 errores) |
| 4+ | ~3,282 pendientes | ⏳ En proceso |

---

## [2026-02-19] — Deduplicaci&oacute;n, performance, aprobaci&oacute;n IA

**Estado: ✅ APLICADO EN PRODUCCION**

### Deduplicaci&oacute;n de personas y conversaciones

Se detect&oacute; que exist&iacute;an personas duplicadas (misma address, mismo canal) creadas por race conditions en Make.com.

**Migraciones aplicadas:**
- `create_dedup_mapping_table`: Tabla de mapeo duplicado &rarr; original
- `dedup_move_interactions`: Reasignar interacciones de duplicados al original
- `dedup_move_person_data`: Mover `person_soft_data` al registro original
- `dedup_delete_orphans`: Eliminar registros hu&eacute;rfanos
- `prevent_duplicate_conversations`: Trigger para prevenir duplicados futuros

### Optimizaci&oacute;n de performance

- `add_missing_indexes_for_conversations`: &Iacute;ndices faltantes en tablas de conversaciones
- `optimize_get_conversations_v2` y `v3`: Reescritura de la RPC principal
- `add_last_activity_column_and_trigger`: Columna materializada + trigger para evitar subqueries

### Sistema de aprobaci&oacute;n IA

- `create_approve_ai_response`: RPC para aprobar respuestas IA (cambia evaluation a 'approved', crea interacci&oacute;n de salida, llama webhook Make.com)
- `create_reject_ai_response`: RPC para rechazar
- `add_duplicate_guard_to_approve_ai_response`: Previene doble aprobaci&oacute;n
- `add_unique_pending_per_interaction`: Constraint &uacute;nico para que solo haya 1 respuesta IA pendiente por interacci&oacute;n
- `drop_legacy_approve_interaction`: Elimina RPC vieja

### Otros

- `create_get_chat_detail_rpc`: Nueva RPC que retorna todo el detalle del chat en una sola query (persona, canal, mensajes, IA, ads, media)
- `add_instagram_username_field` + `update_process_incoming_with_username_and_dedup`: Soporte para username de Instagram
- `fix_timezone_get_msgs_per_day` + `fix_timezone_channel_analysis`: Fix de zona horaria en RPCs de analytics

---

## [2026-02-18] — Botones r&aacute;pidos de filtro para operadores

**Estado: ✅ DESPLEGADO**

### Nueva feature: Filtros r&aacute;pidos de IA

Se agregaron 2 botones de acceso r&aacute;pido en la pantalla de Conversaciones:

- **🤖 Pendientes** &mdash; Conversaciones con respuestas IA pendientes (ayer + hoy)
- **✅ Aprobadas hoy** &mdash; Conversaciones aprobadas hoy

**Cambios t&eacute;cnicos:**
- `Conversations.jsx`: Nuevos estados `autoLoad` y `activeQuick`
- RPC `get_conversations`: Nuevo status `ai_approved` + filtro fechas por `interactions.time_stamp`
- Migraci&oacute;n: `add_ai_approved_status_and_fix_date_filter`

---

## [2026-02-18] — Fix 4 Bugs Cr&iacute;ticos

**Estado: ✅ APLICADOS Y VERIFICADOS**

| Bug | Descripci&oacute;n | Componente | Estado |
|-----|-------------|------------|--------|
| BUG-001 | `updateAi()` actualizaba tabla `interactions` en vez de `ai_interaction` | Frontend | ✅ |
| BUG-002 | `sendMessage()` usaba `conversation_id` como `system_conversation_id` | Frontend + EF | ✅ |
| BUG-003 | Interacci&oacute;n con direcci&oacute;n dual (ambas FKs activas) | DB | ✅ |
| BUG-004 | RPCs duplicadas causaban error de ambig&uuml;edad | DB | ✅ |

**Migraciones:** `fix_bug003_dual_direction_interaction`, `fix_bug004_drop_duplicate_rpcs`

---

## Resumen de migraciones aplicadas (cronol&oacute;gico)

| Fecha | Migraci&oacute;n | Descripci&oacute;n |
|-------|-----------|-------------|
| 2026-02-18 | `fix_bug003_dual_direction_interaction` | Constraint `chk_single_direction` |
| 2026-02-18 | `fix_bug004_drop_duplicate_rpcs` | Drop RPCs duplicadas |
| 2026-02-18 | `add_ai_approved_status_and_fix_date_filter` | Status `ai_approved` en filtros |
| 2026-02-18 | `create_dedup_mapping_table` | Tabla mapeo deduplicaci&oacute;n |
| 2026-02-18 | `dedup_move_interactions` | Mover interacciones de duplicados |
| 2026-02-18 | `dedup_move_person_data` | Mover soft_data de duplicados |
| 2026-02-18 | `dedup_delete_orphans` | Eliminar registros hu&eacute;rfanos |
| 2026-02-18 | `prevent_duplicate_conversations` | Trigger anti-duplicados |
| 2026-02-18 | `create_process_incoming_message` | RPC procesamiento mensajes entrantes |
| 2026-02-18 | `add_instagram_username_field` | Campo username Instagram |
| 2026-02-19 | `fix_timezone_get_msgs_per_day` | Fix timezone analytics |
| 2026-02-19 | `fix_timezone_channel_analysis` | Fix timezone channel analysis |
| 2026-02-19 | `add_missing_indexes_for_conversations` | &Iacute;ndices de performance |
| 2026-02-19 | `optimize_get_conversations_v2` | Optimizaci&oacute;n RPC conversaciones |
| 2026-02-19 | `add_last_activity_column_and_trigger` | Columna materializada last_activity |
| 2026-02-19 | `optimize_get_conversations_v3_use_materialized` | V3 con columna materializada |
| 2026-02-19 | `create_get_chat_detail_rpc` | RPC detalle de chat completo |
| 2026-02-19 | `create_approve_ai_response` | RPC aprobar respuesta IA |
| 2026-02-19 | `create_reject_ai_response` | RPC rechazar respuesta IA |
| 2026-02-19 | `drop_legacy_approve_interaction` | Drop RPC legacy |
| 2026-02-19 | `fix_approve_rpc_enum_cast` | Fix cast de enum en approve |
| 2026-02-19 | `fix_approve_rpc_use_person_conversation_path` | Fix path en approve |
| 2026-02-19 | `add_duplicate_guard_to_approve_ai_response` | Guarda anti-doble aprobaci&oacute;n |
| 2026-02-20 | `add_unique_pending_per_interaction` | Constraint &uacute;nico IA pendiente |
| 2026-02-20 | `create_person_enrichment_log` | Tabla tracking enriquecimiento |
| 2026-02-20 | `create_get_persons_for_analysis` | RPC personas para an&aacute;lisis |
| 2026-02-20 | `add_echo_prevention_trigger` | Trigger anti-eco |
| 2026-02-20 | `add_external_ref_dedup_to_echo_trigger` | Guarda dedup external_ref |
| 2026-02-20 | `fix_media_url_in_get_chat_detail` | Fix URL de media en chat |
| 2026-02-20 | `create_get_channel_health` | RPC salud de canales |
| 2026-02-20 | `create_get_vault_secret_function` | Funcion acceso a Vault |
| 2026-02-20 | `enable_pg_cron_enrichment_v2` | Job pg_cron para enriquecimiento |
| 2026-02-20 | `fix_search_path_16_functions` | Fix search_path en 16 funciones |

---

## Bugs conocidos pendientes

### 🔴 Alta prioridad

- **BUG-005:** 59 respuestas IA aprobadas nunca enviadas (`generated_interaction_id = NULL`) — requiere investigacion
- **BUG-007:** Edge Functions sin autenticacion JWT (`verify_jwt: false`) — requiere login en frontend primero (Fase 1)
- **BUG-009:** Endpoint `persons_list` con N+1 queries (muy lento). Tambien `get_volume_by_provider` da timeout
- ~~**BUG-011:** 17 funciones RPC sin `search_path` fijo~~ → ✅ **RESUELTO** (migracion `fix_search_path_16_functions`, 20-feb)

### 🟡 Media prioridad

- **BUG-MEDIA:** Adjuntos de Messenger con tipo MIME completo (`html; charset="utf-8"`) en `medias.type`. Afecta ~6 registros
- **BUG-006:** ~71% de personas sin nombre — **EN PROCESO** (enriquecimiento automatico corriendo, ETA ~29 horas)
- **BUG-008:** Race condition en `clearFilters()` de Conversations.jsx
- **107 interacciones duplicadas** con dependencias en ai_interaction/media (requieren limpieza manual)

### Score actual de advisories Supabase (20-feb-2026)

**Seguridad:**
| Advisory | Cantidad | Estado |
|----------|----------|--------|
| `function_search_path_mutable` | 0 | ✅ Resuelto |
| `rls_policy_always_true` | 30 | ⏳ Requiere RBAC (Fase 4) |
| `auth_leaked_password_protection` | 1 | ⏳ Requiere config Auth |

**Performance:**
| Advisory | Cantidad | Estado |
|----------|----------|--------|
| Indices no usados | 16 | ⏳ P2 — tablas RBAC/pagos vacias |
| Auth conexiones absolutas | 1 | ⏳ P2 — cambiar a porcentaje |
