# Reporte de Auditoría Técnica y Seguridad del Sistema IITA CRM

**Fecha:** 2026-02-20
**Autor IA:** Gemini CLI 2.0
**Estado:** Crítico (Requiere intervención inmediata en P0)

---

## 1. Resumen Ejecutivo

Este documento presenta los hallazgos de una auditoría técnica profunda realizada sobre el repositorio `iita-system`. El análisis contrastó la documentación existente (`docs/`) con el código fuente real (`database/`).

**Hallazgos Principales:**
1.  **Vulnerabilidad Crítica Confirmada (P0):** La Edge Function `crm-api` expone acceso total de superusuario a la base de datos sin ninguna autenticación ni validación de JWT.
2.  **Inconsistencia Documental (P1):** El BUG-009 (`search_path` mutable) figura como abierto, pero el código fuente muestra que funciones críticas como `get_conversations` y `get_chat_detail` ya han sido remediadas.
3.  **Integridad del Repositorio (P2):** El repositorio carece de definiciones DDL (`CREATE TABLE`, `CREATE POLICY`) para recrear el esquema de base de datos desde cero. No es una fuente de verdad completa.

---

## 2. Auditoría de Seguridad

### 2.1 Edge Functions: Exposición Total (BUG-011)
**Severidad:** Crítica (10/10)
**Estado:** Confirmado en Código

El archivo `database/edge-functions/crm-api/index.ts` implementa un servidor HTTP inseguro:

```typescript
// EVIDENCIA: database/edge-functions/crm-api/index.ts
// L14: Uso de Service Role Key (Superusuario) sin Auth
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// L23-35: CRUD Genérico expuesto públicamente
switch (action) {
  case "delete": { result = await sb.from(table).delete().eq("id", id).select(); break; }
  // ...
}
```

**Impacto:**
Cualquier actor malintencionado con la URL de la función puede ejecutar comandos `DELETE`, `UPDATE` o `INSERT` arbitrarios sobre cualquier tabla del sistema (`persons`, `users`, etc.) simplemente enviando un JSON.
- **Recomendación Inmediata:** Implementar middleware de verificación JWT o retirar la `SERVICE_ROLE_KEY` y usar RLS con un cliente anónimo si es posible (aunque para operaciones de sistema se requiere rol de servicio, debe estar protegido).

### 2.2 Funciones SQL y `search_path` (BUG-009)
**Severidad:** Alta (si no se corrige)
**Estado:** Parcialmente Resuelto (Discrepancia con Docs)

La documentación lista 15 funciones vulnerables. El análisis del código muestra que al menos 2 críticas ya incluyen el parche:

- `get_conversations.sql`: **Protegida** (`SET search_path = public`)
- `get_chat_detail.sql`: **Protegida** (`SET search_path = public`)

**Recomendación:** Auditar las 13 funciones restantes. Si ya están corregidas en la base de datos pero no en el repo, actualizar el repo. Si no, aplicar el parche. Actualizar `BUGS-CONOCIDOS.md` para reflejar el progreso real.

### 2.3 Políticas RLS (BUG-010)
**Severidad:** Alta
**Estado:** No Auditable (Falta Código)

No fue posible auditar las políticas `USING(true)` reportadas porque el repositorio **no contiene los archivos de definición de tablas ni políticas**.
- **Riesgo:** Si las tablas se crearon manualmente en Supabase dashboard, no hay control de versiones ni posibilidad de revisión de seguridad automatizada.

---

## 3. Revisión de Arquitectura y Datos

### 3.1 Dependencia de Make.com
El sistema delega lógica de negocio crítica (creación de personas, interacciones) a 117 escenarios de Make.com.
- **Riesgo:** La lógica dispersa en JSONs de terceros es difícil de versionar, testear y mantener. Los bugs reportados (Pérdida de Captions, IDs corruptos) son síntoma de esta fragilidad.
- **Opinión:** La arquitectura debería migrar gradualmente la lógica de ingestión de datos a Edge Functions o Webhooks propios para tener control total y tests unitarios, usando Make solo para orquestación simple.

### 3.2 Modelo de Datos "Soft Data"
El uso extensivo de `person_soft_data` (Key-Value) para enriquecimiento es flexible pero peligroso a escala.
- **Observación:** Dificulta consultas SQL eficientes y la integridad referencial.
- **Recomendación:** Monitorear el rendimiento. Si ciertos atributos se vuelven críticos para el negocio (ej: "Interés de Curso"), deben promoverse a columnas reales en la tabla `persons`.

---

## 4. Análisis de Propuestas Pendientes

### Propuesta #2: Auto-cancel de IA
**Opinión:** **Aprobada y Prioritaria.**
Es inaceptable desde el punto de vista de UX que la IA responda después de que un humano ya lo hizo.
- **Mejora Sugerida:** No usar un trigger DB (acoplamiento). Usar una Edge Function que sea llamada por el frontend al enviar un mensaje manual, o por Make.com en el flujo de salida.

### Propuesta #6: Limpieza de Duplicados
**Opinión:** **Aprobada con Cautela.**
La existencia de 107 duplicados en `person_conversation` corrompe las métricas.
- **Advertencia:** El script de limpieza debe manejar `ON DELETE CASCADE` o reasignar referencias en `interactions` antes de borrar. Se requiere un backup completo antes de ejecución.

### Propuesta #5: Fix search_path
**Opinión:** **En Progreso.**
Como se evidenció en 2.2, esto ya se está aplicando. Se debe formalizar la finalización de las 15 funciones.

---

## 5. Conclusión del Experto

El sistema IITA CRM se encuentra en una **fase crítica de transición**. Funcionalmente es rico y ambicioso, pero su base de seguridad es extremadamente frágil debido a la exposición de la API (BUG-011).

**Hoja de Ruta Sugerida (Immediate Action Plan):**
1.  **BLOQUEO (Horas):** Implementar validación básica de API Key o JWT en `crm-api/index.ts`. No esperar al Login de Frontend para esto; proteger la API es independiente.
2.  **LIMPIEZA (Días):** Extraer el esquema actual de Supabase (usando `supabase db dump` o similar) y comitearlo al repo para tener visibilidad real de tablas y RLS.
3.  **CORRECCIÓN (Semanas):** Finalizar el parche de `search_path` y proceder con la migración de storage (FEAT-017).

*Firmado digitalmente,*
**Gemini CLI 2.0**
*Ingeniero de Sistemas IA*
