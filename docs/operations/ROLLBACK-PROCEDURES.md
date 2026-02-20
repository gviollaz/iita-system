# Procedimientos de Rollback

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Procedimientos Generales

### Rollback de Funciones SQL

Para revertir una funcion SQL creada o modificada:

```sql
-- Eliminar la funcion (especificar parametros si tiene overloads)
DROP FUNCTION IF EXISTS nombre_funcion(tipo_param1, tipo_param2);
```

**Nota:** Si se modifico una funcion existente, se necesita el SQL original para restaurarla. Siempre verificar en MIGRATIONS-LOG.md si existe una version anterior.

---

### Rollback de Triggers

Para revertir un trigger y su funcion asociada:

```sql
-- 1. Eliminar el trigger de la tabla
DROP TRIGGER IF EXISTS trg_nombre_trigger ON nombre_tabla;

-- 2. Eliminar la funcion del trigger
DROP FUNCTION IF EXISTS nombre_funcion_trigger();
```

**Orden:** Siempre eliminar primero el trigger y luego la funcion. Si se elimina la funcion primero, el trigger quedara huerfano y puede causar errores.

---

### Rollback de Columnas

Para revertir una columna agregada a una tabla:

```sql
-- Eliminar la columna (CUIDADO: se pierden todos los datos de esa columna)
ALTER TABLE nombre_tabla DROP COLUMN IF EXISTS nombre_columna;
```

**Advertencia:** Esta operacion es destructiva e irreversible para los datos de esa columna. Verificar que no haya funciones, triggers o vistas que dependan de la columna antes de eliminarla.

---

### Rollback de Indices

Para revertir un indice creado:

```sql
-- Eliminar el indice
DROP INDEX IF EXISTS idx_nombre_indice;
```

**Nota:** Eliminar un indice no afecta los datos, solo el rendimiento de las consultas. Es seguro de ejecutar.

---

### Rollback de Datos de Enriquecimiento

Para revertir datos generados por el proceso de enriquecimiento con IA:

```sql
-- 1. Eliminar datos enriquecidos de person_soft_data
DELETE FROM person_soft_data
WHERE source = 'ai_enrichment';

-- 2. Eliminar registros del log de enriquecimiento
DELETE FROM person_enrichment_log;
```

**Verificacion:**
```sql
-- Confirmar que se eliminaron los datos
SELECT COUNT(*) FROM person_soft_data WHERE source = 'ai_enrichment';
-- Esperado: 0

SELECT COUNT(*) FROM person_enrichment_log;
-- Esperado: 0
```

---

### Rollback de Edge Functions

Para revertir una Edge Function a una version anterior:

1. Obtener el codigo de la version anterior (desde el repositorio o snapshot).
2. Redesplegar la version anterior usando el dashboard de Supabase o la herramienta MCP `deploy_edge_function`.

**Nota:** Supabase no mantiene un historial de versiones de Edge Functions accesible por API. Siempre mantener el codigo versionado en el repositorio.

---

## Rollbacks Especificos

### Rollback: Fix Media URL en get_chat_detail

**Migracion:** `fix_media_url_in_get_chat_detail` (2026-02-20)

```sql
-- Restaurar get_chat_detail sin el campo media_url
-- NOTA: Requiere el SQL de la version anterior de la funcion
-- Verificar en el snapshot previo o en el historial de migraciones
DROP FUNCTION IF EXISTS get_chat_detail(bigint);

-- Recrear con la version anterior (copiar desde snapshot pre-migracion)
-- CREATE OR REPLACE FUNCTION get_chat_detail(p_conversation_id bigint)
-- ...version anterior...
```

**Impacto del rollback:** El frontend dejara de mostrar media en el chat. Los datos de media siguen en la DB, solo no se devuelven en la consulta.

---

### Rollback: Trigger de Prevencion de Ecos

**Migracion:** `prevent_echo_interaction` (2026-02-19)

```sql
-- Eliminar trigger y funcion
DROP TRIGGER IF EXISTS trg_prevent_echo_interaction ON interactions;
DROP FUNCTION IF EXISTS prevent_echo_interaction();
```

**Impacto del rollback:** Los mensajes eco de Make.com volveran a crear registros duplicados en la tabla `interactions`. Se recomienda reactivar el trigger lo antes posible o corregir el flujo en Make.com para no enviar ecos.

**Verificacion:**
```sql
-- Confirmar que el trigger ya no existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_prevent_echo_interaction';
-- Esperado: 0 filas
```

---

### Rollback: Constraint single_direction

**Migracion:** `chk_single_direction` (2026-02-18)

```sql
-- Eliminar el constraint CHECK
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS chk_single_direction;
```

**Impacto del rollback:** La tabla `interactions` aceptara cualquier valor en el campo `direction`, no solo `incoming` y `outgoing`. Datos inconsistentes podrian ingresar.

**Verificacion:**
```sql
-- Confirmar que el constraint ya no existe
SELECT conname FROM pg_constraint WHERE conname = 'chk_single_direction';
-- Esperado: 0 filas
```

---

### Rollback: Trigger de Prevencion de Conversaciones Duplicadas

**Migracion:** `prevent_duplicate_conversation` (2026-02-18)

```sql
-- Eliminar trigger y funcion
DROP TRIGGER IF EXISTS trg_prevent_duplicate_conversation ON person_conversation;
DROP FUNCTION IF EXISTS prevent_duplicate_conversation();
```

**Impacto del rollback:** Las condiciones de carrera en Make.com podran crear conversaciones duplicadas nuevamente. Se recomienda no revertir este trigger a menos que sea estrictamente necesario.

---

### Rollback: Columna last_activity_at

**Migracion:** `add_last_activity_at` (2026-02-18)

```sql
-- 1. Eliminar trigger que actualiza la columna
DROP TRIGGER IF EXISTS trg_update_last_activity ON interactions;
DROP FUNCTION IF EXISTS update_conversation_last_activity();

-- 2. Eliminar la columna
ALTER TABLE conversations DROP COLUMN IF EXISTS last_activity_at;
```

**Impacto del rollback:** Las funciones que usan `last_activity_at` para ordenar conversaciones dejaran de funcionar. Verificar que `get_conversations` y `get_chat_detail` no dependan de esta columna antes de revertir.

---

## Checklist Pre-Rollback

Antes de ejecutar cualquier rollback:

1. [ ] Verificar que el rollback es necesario (no hay otra solucion).
2. [ ] Identificar todas las dependencias de lo que se va a revertir (funciones, triggers, vistas, Edge Functions que usen el objeto).
3. [ ] Comunicar al equipo que se va a hacer un rollback en produccion.
4. [ ] Ejecutar el SQL de rollback en un entorno de prueba primero si es posible.
5. [ ] Tener a mano el SQL para re-aplicar la migracion en caso de que el rollback cause mas problemas.
6. [ ] Documentar el rollback en MIGRATIONS-LOG.md con la fecha y razon.
