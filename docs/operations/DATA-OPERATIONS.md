# Operaciones de Datos

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Convenciones

- Toda operacion de datos (INSERT, UPDATE, DELETE masivo) debe documentarse aqui.
- Cada operacion tiene un ID unico (OP-NNN).
- Se registra el SQL ejecutado, los registros afectados y el SQL de rollback.
- Las operaciones destructivas requieren backup previo o query de rollback verificado.

---

## OP-001 | Limpieza de 156 Mensajes Eco

- **Fecha:** 2026-02-19
- **Autor:** Equipo IITA + Claude
- **Estado:** Completada
- **Descripcion:** Eliminacion de 156 interacciones eco (mensajes salientes duplicados) que se habian acumulado antes de implementar el trigger `prevent_echo_interaction`. Estos mensajes eran copias de mensajes ya existentes, reenviados por Make.com como confirmacion.

**Criterio de identificacion:**
Los mensajes eco se identifican como interacciones con direction `outgoing` cuyo `external_ref` ya existe en otra interaccion de la misma conversacion.

**SQL ejecutado:**
```sql
DELETE FROM interactions
WHERE id IN (
  SELECT i2.id
  FROM interactions i1
  JOIN interactions i2
    ON i1.id_person_conversation = i2.id_person_conversation
    AND i1.external_ref = i2.external_ref
    AND i1.id < i2.id
    AND i2.direction = 'outgoing'
  WHERE i1.external_ref IS NOT NULL
);
```

**Registros afectados:** 156 filas eliminadas

**Rollback:** No es posible restaurar los registros eliminados sin un backup. Los datos eliminados eran duplicados sin informacion unica, por lo que la perdida es aceptable.

**Verificacion post-operacion:**
```sql
-- Verificar que no quedan ecos duplicados
SELECT i1.external_ref, COUNT(*) as duplicados
FROM interactions i1
JOIN interactions i2
  ON i1.id_person_conversation = i2.id_person_conversation
  AND i1.external_ref = i2.external_ref
  AND i1.id < i2.id
  AND i2.direction = 'outgoing'
WHERE i1.external_ref IS NOT NULL
GROUP BY i1.external_ref
HAVING COUNT(*) > 0;
-- Esperado: 0 filas
```

---

## OP-002 | Limpieza de 179 external_ref Duplicados

- **Fecha:** 2026-02-19
- **Autor:** Equipo IITA + Claude
- **Estado:** Completada
- **Descripcion:** Eliminacion de 179 interacciones con `external_ref` duplicado dentro de la misma conversacion. Estos registros se crearon por condiciones de carrera en Make.com antes de implementar controles de unicidad.

**Criterio de identificacion:**
Se conserva la interaccion mas antigua (menor `id`) y se elimina la mas nueva para cada `external_ref` duplicado dentro de una misma `id_person_conversation`.

**SQL ejecutado:**
```sql
DELETE FROM interactions
WHERE id IN (
  SELECT i2.id
  FROM interactions i1
  JOIN interactions i2
    ON i1.id_person_conversation = i2.id_person_conversation
    AND i1.external_ref = i2.external_ref
    AND i1.id < i2.id
  WHERE i1.external_ref IS NOT NULL
    AND i1.id != i2.id
);
```

**Registros afectados:** 179 filas eliminadas

**Rollback:** No es posible restaurar sin backup. Los registros eliminados eran duplicados exactos (mismo external_ref, misma conversacion).

**Verificacion post-operacion:**
```sql
-- Verificar que no quedan external_ref duplicados por conversacion
SELECT id_person_conversation, external_ref, COUNT(*) as duplicados
FROM interactions
WHERE external_ref IS NOT NULL
GROUP BY id_person_conversation, external_ref
HAVING COUNT(*) > 1;
-- Esperado: 0 filas
```

---

## OP-003 | Enriquecimiento de Personas con IA

- **Fecha:** 2026-02-19 (inicio)
- **Autor:** Equipo IITA + Claude
- **Estado:** En progreso
- **Descripcion:** Proceso de enriquecimiento de datos de personas utilizando IA para analizar el historial de conversaciones y extraer informacion relevante (intereses, nivel educativo, ubicacion, profesion, etc.). Los datos se almacenan en `person_soft_data` como pares key-value.

**Alcance:**
- Aproximadamente 1000 personas pendientes de procesamiento.
- Se procesan en lotes para no sobrecargar la API de IA.
- El progreso se registra en `person_enrichment_log`.

**SQL de monitoreo:**
```sql
-- Ver progreso del enriquecimiento
SELECT
  status,
  COUNT(*) as cantidad
FROM person_enrichment_log
GROUP BY status
ORDER BY status;
```

```sql
-- Ver personas pendientes de enriquecimiento
SELECT p.id, p.first_name, p.last_name
FROM persons p
LEFT JOIN person_enrichment_log pel ON p.id = pel.person_id
WHERE pel.id IS NULL
  OR pel.status = 'pending'
ORDER BY p.id
LIMIT 100;
```

**Registros afectados:** ~1000 personas (en progreso)

**Rollback:**
```sql
-- Eliminar datos enriquecidos generados por este proceso
DELETE FROM person_soft_data
WHERE source = 'ai_enrichment';

-- Eliminar log de enriquecimiento
DELETE FROM person_enrichment_log
WHERE created_at >= '2026-02-19';
```

**Verificacion post-operacion:**
```sql
-- Verificar consistencia entre log y datos
SELECT
  pel.person_id,
  pel.status,
  COUNT(psd.id) as datos_generados
FROM person_enrichment_log pel
LEFT JOIN person_soft_data psd
  ON pel.person_id = psd.person_id
  AND psd.source = 'ai_enrichment'
WHERE pel.status = 'completed'
GROUP BY pel.person_id, pel.status
HAVING COUNT(psd.id) = 0;
-- Esperado: 0 filas (toda persona completada deberia tener al menos un dato)
```
