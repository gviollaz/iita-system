# Bugs Conocidos

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Bugs Abiertos

### BUG-001 | P0 | Captions perdidos en WA Cloud API

- **Componente:** Make.com - Escenario 4097069, Modulo 8
- **Descripcion:** El campo `image.caption` esta hardcodeado en el modulo de procesamiento de mensajes entrantes de WhatsApp Cloud API. Cuando llega una imagen con caption, el texto del caption se pierde porque no se extrae dinamicamente del payload.
- **Causa raiz:** Se usa `image.caption` como string fijo en vez de mapear `{{6.Messages}}` que contiene el caption real del mensaje.
- **Impacto:** Perdida de informacion en todos los mensajes con media que incluyen caption por WA Cloud API.
- **Solucion propuesta:** Cambiar el mapeo hardcoded por `{{6.Messages}}` para extraer el caption real del payload.

---

### BUG-002 | P0 | Media IDs corruptos en WA Coexistence

- **Componente:** Make.com - Escenario 4161348, Modulo 6
- **Descripcion:** La funcion `if()` que determina el media ID esta mal estructurada: el sticker ID se concatena fuera de la condicion, provocando que IDs de stickers se mezclen con IDs de otros tipos de media.
- **Causa raiz:** El bloque condicional `if()` no envuelve correctamente la rama del sticker ID, resultando en concatenacion incorrecta.
- **Impacto:** Media IDs corruptos en la base de datos para mensajes con stickers, imposibilitando la descarga posterior del archivo.
- **Solucion propuesta:** Reestructurar el `if()` para que el sticker ID solo se incluya dentro de su condicion correspondiente.

---

### BUG-003 | P0 | video.id en vez de video.caption en WA Coexistence

- **Componente:** Make.com - Escenario 4161348, Modulo 7
- **Descripcion:** Se extrae `video.id` donde deberia extraerse `video.caption`, causando que el ID del video se guarde como texto del mensaje.
- **Causa raiz:** Error de mapeo en el modulo: se selecciono el campo incorrecto del objeto video.
- **Impacto:** El caption de los videos se pierde y en su lugar se almacena un ID interno sin sentido para el usuario.
- **Solucion propuesta:** Cambiar el mapeo de `video.id` a `video.caption`.

---

### BUG-004 | P0 | Media analysis apunta a DB de desarrollo

- **Componente:** Make.com - Escenario 4105815
- **Descripcion:** El escenario de analisis de media esta configurado con la conexion a la base de datos de desarrollo en lugar de produccion.
- **Causa raiz:** El escenario se creo en entorno dev y no se actualizo la conexion al pasarlo a produccion.
- **Impacto:** Los resultados del analisis de media se escriben en la DB de desarrollo, no en produccion. Los datos se pierden desde la perspectiva del sistema productivo.
- **Solucion propuesta:** Desactivar el escenario inmediatamente. Reconfigurar la conexion apuntando a la DB de produccion antes de reactivar.

---

### BUG-005 | P1 | Falta person_name en flujo Instagram

- **Componente:** Make.com - Flujo de entrada Instagram
- **Descripcion:** El flujo de entrada de Instagram no extrae ni envia el nombre de la persona (`person_name`) al crear o actualizar el registro en Supabase.
- **Causa raiz:** El campo no fue mapeado en los modulos de procesamiento del flujo Instagram.
- **Impacto:** Las personas que llegan por Instagram se crean sin nombre, dificultando su identificacion en el CRM.
- **Solucion propuesta:** Agregar el mapeo de `person_name` desde el payload de Instagram al subscenario de procesamiento.

---

### BUG-006 | P1 | Falta ad_id/ad_external_ref en todos los flujos

- **Componente:** Make.com - Todos los flujos de entrada (WA Cloud, WA Coexistence, Instagram)
- **Descripcion:** Ningun flujo de entrada extrae ni envia el `ad_id` o `ad_external_ref` cuando el mensaje proviene de un anuncio publicitario.
- **Causa raiz:** Los campos de anuncios no fueron incluidos en el diseno original de los flujos de entrada.
- **Impacto:** No se puede rastrear que conversaciones fueron originadas por anuncios, impidiendo medir ROI publicitario.
- **Solucion propuesta:** Agregar extraccion de `ad_id` del payload de cada canal y mapearlo a la tabla correspondiente.

---

### BUG-007 | P1 | Falta status "new" en WA Coexistence

- **Componente:** Make.com - Escenario 4161348
- **Descripcion:** El flujo de WA Coexistence no asigna el status `new` a las interacciones entrantes, dejando el campo vacio.
- **Causa raiz:** El campo `status` no fue incluido en el mapeo del modulo de creacion de interacciones.
- **Impacto:** Las interacciones de WA Coexistence no siguen el ciclo de estados correcto (`new` -> `preprocessed` -> ...), afectando filtros y reportes.
- **Solucion propuesta:** Agregar `status: "new"` como valor por defecto en el modulo de creacion de interacciones del escenario.

---

### BUG-008 | P1 | Echo text hardcoded "Respondido desde telefono"

- **Componente:** Make.com - Flujos de respuesta
- **Descripcion:** Cuando se envia una respuesta desde el telefono (no desde el CRM), el texto que se almacena en la DB es el string fijo "Respondido desde telefono" en vez del contenido real de la respuesta.
- **Causa raiz:** El mapeo del texto de respuesta usa un string hardcoded en lugar del campo dinamico con el texto real.
- **Impacto:** Se pierde el contenido real de las respuestas enviadas desde el telefono. El historial de la conversacion es incompleto.
- **Solucion propuesta:** Cambiar el texto hardcoded por el campo dinamico que contiene la respuesta real.

---

### BUG-009 | P1 | search_path mutable en 15 funciones PostgreSQL

- **Componente:** Supabase - Base de datos PostgreSQL
- **Descripcion:** 15 funciones PostgreSQL tienen `search_path` mutable, lo que permite ataques de inyeccion de schema.
- **Funciones afectadas:**
  - `approve_ai_response`
  - `get_chat_detail`
  - `find_or_create_conversation`
  - `get_crm_stats`
  - `get_conversations`
  - `get_channel_analysis`
  - `get_msgs_per_day`
  - `get_volume_by_channel`
  - `get_volume_by_provider`
  - `get_top_leads`
  - `get_unanswered_conversations`
  - `get_person_detail`
  - `get_person_full_profile`
  - `get_persons_enriched`
  - `search_persons`
- **Referencia:** https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- **Solucion propuesta:** Agregar `SET search_path = public` en la definicion de cada funcion. Ver PROPUESTAS-PENDIENTES.md Propuesta #5.

---

### BUG-010 | P1 | ~30 RLS policies con USING(true)

- **Componente:** Supabase - Base de datos PostgreSQL
- **Descripcion:** Aproximadamente 30 politicas RLS usan `USING(true)` o `WITH CHECK(true)` en operaciones INSERT/UPDATE/DELETE, lo que equivale a no tener RLS.
- **Tablas afectadas:** `ai_interaction`, `conversations`, `interactions`, `persons`, `person_contacts`, `person_conversation`, `person_soft_data`, `system_conversation`, `courses`, `course_editions`, `course_edition_schedule`, `course_members`, `course_tickets`, `users`, `branche_users`
- **Referencia:** https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy
- **Solucion propuesta:** Reemplazar por condiciones basadas en `auth.uid()` una vez implementado RBAC (FEAT-010 + FEAT-011).

---

### BUG-011 | P0 | Edge Functions sin autenticacion JWT

- **Componente:** Supabase - Edge Functions (crm-api, courses-crud, create-test-user)
- **Descripcion:** Las tres Edge Functions tienen `verify_jwt: false`, permitiendo acceso sin autenticacion a toda la API.
- **Dependencia:** Requiere FEAT-010 (Login con Supabase Auth) implementado primero. Si se habilita JWT sin login, el CRM deja de funcionar.
- **Impacto:** Cualquier persona con la URL de la API puede leer y modificar 25K+ registros personales.
- **Solucion propuesta:** Implementar login en el CRM (FEAT-010), luego habilitar `verify_jwt: true` en las Edge Functions.

---

## Bugs Resueltos

### BUG-R001 | Resuelto 2026-02-20 | Media no se mostraba en chat

- **Componente:** Supabase - Funcion `get_chat_detail`
- **Descripcion:** La funcion RPC `get_chat_detail` no incluia la URL de media en los resultados, por lo que el frontend no podia mostrar imagenes ni videos en el chat.
- **Solucion:** Migracion `fix_media_url_in_get_chat_detail` que agrega el campo `media_url` al resultado de la funcion, haciendo JOIN con `interaction_medias` y `medias`.
- **Fecha de resolucion:** 2026-02-20

---

### BUG-R002 | Resuelto 2026-02-19 | Mensajes eco duplicados

- **Componente:** Supabase - Tabla `interactions`
- **Descripcion:** Cuando Make.com reenviaba un mensaje saliente como confirmacion, se creaba un registro duplicado (eco) en la tabla de interacciones.
- **Solucion:** Trigger `prevent_echo_interaction` que detecta y bloquea la insercion de mensajes eco basandose en `external_ref` y `direction`.
- **Fecha de resolucion:** 2026-02-19

---

### BUG-R003 | Resuelto 2026-02-18 | Conversaciones duplicadas

- **Componente:** Supabase - Tabla `conversations`
- **Descripcion:** Condiciones de carrera en Make.com provocaban la creacion de conversaciones duplicadas para la misma persona y canal.
- **Solucion:** Trigger `prevent_duplicate_conversation` con bloqueo `FOR UPDATE` que verifica unicidad antes de insertar.
- **Fecha de resolucion:** 2026-02-18
