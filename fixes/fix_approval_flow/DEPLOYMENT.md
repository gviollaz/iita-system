# Fix: Aprobación desde Frontend (bypass Google Sheets)

## Fecha: 2026-02-18

## Resumen
Se elimina la dependencia de Google Sheets para aprobar y despachar mensajes.
La aprobación ahora se dispara directamente desde el frontend CRM vía Supabase RPC → webhook Make.com → dispatcher existente.

## Cambios realizados

### 1. Supabase - Función RPC (YA APLICADO ✅)
- **Función:** `approve_interaction(p_ai_interaction_id int, p_webhook_url text)`
- **Migración:** `create_approve_interaction_rpc` + `fix_approve_interaction_search_path`
- Valida que la evaluación esté en `pending`
- Previene doble aprobación (idempotente)
- Actualiza `ai_interaction.evaluation = 'approved'`
- Actualiza `interactions.status = 'pending_delivery'`
- Dispara webhook a Make.com vía pg_net

### 2. Make.com - Nuevo escenario webhook (MANUAL 🔧)
- **Blueprint referencia:** `NEW_webhook_approve_dispatcher.json`
- **Nombre sugerido:** `IITA - Approve & Dispatch (Producción)`
- Solo 2 módulos: Custom Webhook → Call Subscenario (dispatcher SCN_4124755)

### 3. Make.com - Renombrar escenario legacy (MANUAL 🔧)
- **Escenario:** 4124998 `Generate Interactions from Google Sheets`
- **Nuevo nombre:** `[LEGACY] Generate Interactions from Google Sheets`
- **Acción:** DESACTIVAR después de confirmar que el nuevo flujo funciona

---

## Pasos de deployment (en orden)

### Paso 1: Crear escenario webhook en Make.com
1. Ir a Make.com → Create a new scenario
2. Agregar módulo **Custom Webhook** (Webhooks → Custom webhook)
3. Click "Add" para crear un nuevo webhook, nombrarlo "Approve Interaction Trigger"
4. **COPIAR la URL del webhook** (la vas a necesitar en Paso 2)
5. Agregar módulo **Call Subscenario** (Scenario service → Call a Subscenario)
6. Seleccionar escenario: **IITA - Message dispatcher (Producción)** (SCN_4124755)
7. En Scenario Inputs, mapear: `id_interaction` = `{{1.id_interaction}}`
8. Marcar "Wait for the scenario to finish" = Yes
9. **Guardar** el escenario (NO activar todavía)

### Paso 2: Configurar webhook URL en Supabase
En Supabase SQL Editor, ejecutar:
```sql
ALTER DATABASE postgres SET app.make_webhook_url = 'https://hook.us2.make.com/XXXXXXXXX';
```
(Reemplazar con la URL real del Paso 1)

**IMPORTANTE:** Después de ejecutar esto, reiniciar la conexión de Supabase:
- Ir a Settings → Database → Connection Pooling → Click "Restart"
- O esperar unos minutos para que tome efecto

### Paso 3: Probar el flujo completo
1. En Supabase SQL Editor, buscar un ai_interaction pendiente:
```sql
SELECT ai.id, ai.evaluation, ai.generated_interaction_id, i.status, i.text
FROM ai_interaction ai
JOIN interactions i ON ai.generated_interaction_id = i.id
WHERE ai.evaluation = 'pending'
ORDER BY ai.id DESC
LIMIT 5;
```
2. **Activar** el nuevo escenario webhook en Make.com (toggle ON)
3. Ejecutar la aprobación de prueba:
```sql
SELECT approve_interaction(ID_DEL_PASO_1);
```
4. Verificar en Make.com que el escenario se ejecutó
5. Verificar en Supabase:
```sql
SELECT ai.evaluation, i.status 
FROM ai_interaction ai
JOIN interactions i ON ai.generated_interaction_id = i.id
WHERE ai.id = ID_DEL_PASO_1;
-- Debería mostrar: evaluation='approved', status='sending' o 'send'
```

### Paso 4: Renombrar y desactivar escenario legacy
1. Ir a Make.com → Escenario 4124998
2. Renombrar a: `[LEGACY] Generate Interactions from Google Sheets`
3. **Desactivar** el escenario (toggle OFF)

### Paso 5: Integrar en frontend CRM
Desde el frontend, llamar a la función RPC:
```javascript
const { data, error } = await supabase.rpc('approve_interaction', {
  p_ai_interaction_id: aiInteractionId
});

if (data?.success) {
  // Mensaje aprobado y despachado
} else {
  // Manejar error: data?.error
}
```

---

## Rollback
Si algo falla:
1. Desactivar el nuevo escenario webhook en Make.com
2. Reactivar y renombrar el escenario 4124998 (sacarle [LEGACY])
3. La función RPC puede quedarse, no interfiere con nada

## Escenarios afectados

| ID | Nombre | Acción |
|----|--------|--------|
| NUEVO | IITA - Approve & Dispatch (Producción) | Crear y activar |
| 4124998 | Generate Interactions from Google Sheets | Renombrar a [LEGACY] + desactivar |
| 3502129 | Create Google Sheets Records | SIN CAMBIOS (sigue escribiendo a GSheets) |
| 4124755 | IITA - Message dispatcher (Producción) | SIN CAMBIOS |
