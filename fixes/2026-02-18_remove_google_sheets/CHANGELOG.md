# 2026-02-18_remove_google_sheets

## Fecha: 2026-02-18

## Escenarios modificados

| ID | Nombre | Cambio realizado |
|----|--------|------------------|
| 4168577 | Approve & Dispatch (Producción) | Reescrito: query ai_interaction, validación deadline 24h, crea interacción pending_delivery, update generated_interaction_id |
| 4125079 | Sending Messages (Producción) | Eliminada ruta "Send" con Google Sheets (Salta + San Lorenzo), queda solo pending_delivery → dispatcher |

## Descripción

Se eliminan todas las referencias a Google Sheets del flujo de aprobación y envío.
El legacy usaba sheets como intermediario; ahora todo pasa por Supabase.

### Flujo corregido:
1. Frontend → Approve & Dispatch (webhook con id_ai_interaction)
2. Approve & Dispatch → valida deadline, crea interacción pending_delivery, actualiza ai_interaction
3. Supabase webhook dispara Sending Messages
4. Sending Messages → Message Dispatcher → envía mensaje

### Frontend: cambio requerido
El webhook ahora espera `id_ai_interaction` en vez de `id_interaction`.
