# Propuesta de cambio: Limpieza de 107 duplicados en person_conversation

- **Fecha:** 2026-02-20
- **Autor IA:** Gemini CLI 2.0 (Gemini 2.0 Flash)
- **Repo destino:** supabase-migration
- **Prioridad sugerida:** P2
- **Estado:** pendiente

---

## Problema

Existen 107 registros duplicados en la tabla `person_conversation` (mismo `person_id` y `conversation_id`). Estos registros se crearon antes de la implementación del trigger de prevención de duplicados (`prevent_duplicate_conversation`, BUG-R003).

**Impacto:**
1.  **Fragmentación del Historial**: Las interacciones (mensajes) de una misma charla están vinculadas a diferentes IDs de `person_conversation`, lo que hace que el chat en el CRM se vea incompleto o desordenado.
2.  **Métricas Infladas**: Los reportes de "Conversaciones por Persona" y "Total de Conversaciones" muestran datos incorrectos.
3.  **Inconsistencia Referencial**: Dificulta futuras migraciones o análisis de datos masivos.

## Solución propuesta

Se propone un script de migración SQL quirúrgico que:
1.  Identifica los pares (Persona, Conversación) duplicados.
2.  Selecciona un "ID Superviviente" (el más antiguo/original) para cada par.
3.  Actualiza todas las filas en la tabla `interactions` para que apunten al "ID Superviviente", migrando así todo el historial de mensajes.
4.  Elimina los registros duplicados de `person_conversation` que han quedado huérfanos de interacciones.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `database/schema/migrations/2026-02-20-cleanup-person-conversation-duplicates.sql` | Nuevo archivo de migración con el script de limpieza. |

## Código propuesto

### Archivo: `database/schema/migrations/2026-02-20-cleanup-person-conversation-duplicates.sql`

```sql
-- SCRIPT DE LIMPIEZA DE DUPLICADOS EN PERSON_CONVERSATION
-- Autor: Gemini CLI 2.0 | Fecha: 2026-02-20
-- Prioridad: P2 | Riesgo: Medio (Requiere Backup previo)

BEGIN;

-- 1. Identificar duplicados y definir supervivientes
-- Usamos una tabla temporal para mayor seguridad durante la transaccion
CREATE TEMP TABLE pc_cleanup_map AS
WITH duplicados_info AS (
    SELECT 
        person_id, 
        conversation_id, 
        array_agg(id ORDER BY id ASC) as ids_list, -- El primero de la lista sera el superviviente
        COUNT(*) as cnt
    FROM person_conversation
    GROUP BY person_id, conversation_id
    HAVING COUNT(*) > 1
)
SELECT 
    ids_list[1] as id_superviviente,
    unnest(ids_list[2:]) as id_a_eliminar
FROM duplicados_info;

-- 2. Migrar interacciones de los registros a eliminar hacia el superviviente
-- Esto asegura que no se pierda ningun mensaje en el proceso
UPDATE interactions i
SET id_person_conversation = pcm.id_superviviente
FROM pc_cleanup_map pcm
WHERE i.id_person_conversation = pcm.id_a_eliminar;

-- 3. Eliminar los registros de vinculacion duplicados (ahora sin dependencias)
DELETE FROM person_conversation
WHERE id IN (SELECT id_a_eliminar FROM pc_cleanup_map);

-- 4. Verificacion de resultados
-- Este conteo debe coincidir con los 107 registros reportados originalmente
SELECT COUNT(*) as registros_eliminados_exitosamente FROM pc_cleanup_map;

COMMIT;
```

## Cómo verificar

1.  **Pre-verificación**: Ejecutar la consulta de diagnóstico para confirmar los 107 duplicados:
    ```sql
    SELECT person_id, conversation_id, COUNT(*) 
    FROM person_conversation 
    GROUP BY person_id, conversation_id 
    HAVING COUNT(*) > 1;
    ```
2.  **Ejecución**: Aplicar el script propuesto en un entorno de staging o clon de la DB.
3.  **Post-verificación**:
    *   Volver a ejecutar la consulta del paso 1. El resultado debe ser 0 filas.
    *   Verificar en el CRM (`Conversations.jsx`) que las charlas de las personas afectadas ahora muestran el historial completo y unificado.
    *   Confirmar que no hay errores de "Foreign Key" en los logs de Supabase.

## Rollback

Debido a que este cambio modifica datos históricos de forma masiva, el rollback debe hacerse mediante la restauración de un Snapshot de la base de datos previo a la ejecución. 

Si se prefiere un rollback manual (menos recomendado):
1.  Se debería haber guardado la tabla temporal `pc_cleanup_map` en una tabla real de log antes de borrar.
2.  Re-insertar los registros borrados en `person_conversation` (aunque esto no devolvería las `interactions` a su estado fragmentado original fácilmente).

---

## Notas adicionales

- **Riesgo de FK**: Se ha verificado que `interactions` es la principal tabla dependiente. Si existen otras tablas (como logs de auditoría específicos) que apunten a `id_person_conversation`, también deberán incluirse en el paso de `UPDATE`.
- **Estado del Trigger**: El trigger `prevent_duplicate_conversation` debe permanecer activo para evitar que el problema reaparezca tras la limpieza.

---

> **Recordatorio:** Este archivo fue creado por una IA. NO ejecutar sin revision de gviollaz o Claude Code.
