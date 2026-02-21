# Bugs Conocidos

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Bugs Abiertos

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

### BUG-008 | P1 | Echo text hardcoded "Respondido desde telefono"

- **Componente:** Make.com - Flujos de respuesta
- **Descripcion:** Cuando se envia una respuesta desde el telefono (no desde el CRM), el texto que se almacena en la DB es el string fijo "Respondido desde telefono" en vez del contenido real de la respuesta.
- **Causa raiz:** El mapeo del texto de respuesta usa un string hardcoded en lugar del campo dinamico con el texto real.
- **Impacto:** Se pierde el contenido real de las respuestas enviadas desde el telefono. El historial de la conversacion es incompleto.
- **Solucion propuesta:** Cambiar el texto hardcoded por el campo dinamico que contiene la respuesta real.

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

---

### BUG-R004 | Resuelto 2026-02-20 | search_path mutable en 15 funciones PostgreSQL

- **Componente:** Supabase - Base de datos PostgreSQL
- **Descripcion:** 15 funciones PostgreSQL tenian `search_path` mutable, lo que permitia ataques de inyeccion de schema.
- **Solucion:** Se agrego `SET search_path = public` en la definicion de las 15 funciones del repositorio.
- **Verificado por:** Gemini 3 (Auditoria de codigo fuente)
- **Fecha de resolucion:** 2026-02-20 (Correccion en repositorio)
- **Nota:** Pendiente verificar que los cambios hayan sido desplegados (recreados) en la base de datos de produccion de Supabase.

---

### Bugs Resueltos y Falsos Positivos de Make.com (Verificados por IA)

Los siguientes bugs fueron reportados como abiertos (P0), pero la auditoría de los JSON del repositorio `iita-make-scenarios` (`2026-02-19_produccion`) demostró que **ya se encuentran solucionados en producción**. *(Auditoría: Gemini 3 el 2026-02-20)*:

- **BUG-R005 (Ex BUG-001): Captions perdidos en WA Cloud API**: El escenario `4097069` ya mapea correctamente las variables dinámicas `{{1.entry[].changes[].value.messages[].image.caption}}` en lugar de strings fijos.
- **BUG-R006 (Ex BUG-002): Media IDs corruptos en WA Coexistence**: El escenario `4161348` (línea 778) ya tiene la estructura `if()` corregida y el `sticker.id` está anidado correctamente.
- **BUG-R007 (Ex BUG-003): video.id en vez de video.caption**: El escenario `4161348` (línea 831) extrae `video.caption` adecuadamente.
- **BUG-R008 (Ex BUG-004): Falso Positivo (Media analysis dev)**: Se reportó sobre el escenario obsoleto `4105815`. El escenario activo en producción (`4132732`) apunta correctamente a la DB productiva (`postgres.cpkzzzwncpbzexpesock`).
- **BUG-R009 (Ex BUG-007): Falso Positivo (Falta status "new")**: La función SQL `process_incoming_message` asigna el status `'new'` de forma nativa por diseño (hardcodeado en el INSERT). Make.com no debe enviar este parámetro.
