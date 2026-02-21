# Rediseño del Flujo de Aprobación/Rechazo — Propuesta Arquitectónica

**Fecha:** 19 de febrero de 2026  
**Autor:** Análisis arquitectónico  
**Estado:** PROPUESTA — Para revisión y aprobación de Gustavo

---

## 1. DIAGNÓSTICO: EL PROBLEMA REAL

### 1.1 Lo que encontré en la base de datos (no es teoría)

**3,655 interacciones salientes duplicadas** en total. 34 hoy, 20 ayer. El patrón es consistente: una primera interacción con `status='send'` (enviada correctamente) seguida 1-3 segundos después por una o dos copias con `status='preprocessed'` (atascadas).

Ejemplo real (ai_id=12276, conversation sc_id=1397):

| ID | Timestamp | Status | ¿Qué pasó? |
|----|-----------|--------|-------------|
| 102425 | 02:50:16.794 | `send` | ✅ La real — creada por Approve & Dispatch |
| 102426 | 02:50:18.088 | `preprocessed` | ❌ Duplicada — creada 1.3s después |
| 102427 | 02:50:18.113 | `preprocessed` | ❌ Duplicada — creada 25ms después de la anterior |

**5 respuestas rechazadas (`confictive`) que fueron enviadas igual al cliente.** Ejemplo real: ai_id=5166 tiene `evaluation='confictive'` pero `generated_interaction_id=102233` con `status='send'`. El mensaje se envió y DESPUÉS se rechazó.

### 1.2 Corrección importante sobre triggers

**NO hay ningún trigger en `ai_interaction`.** Todos los triggers están en `interactions`:

| Trigger | Evento | ¿Tiene filtro WHEN? |
|---------|--------|---------------------|
| `New_interaction` | AFTER INSERT | NO |
| `Pre-Processing` | AFTER INSERT | NO |
| `New_pending_delivery_and_send` | AFTER INSERT OR UPDATE | NO |
| `Respond Generation - Prod` | AFTER UPDATE | NO |
| `trg_update_conv_last_activity` | AFTER INSERT | NO |

Ninguno tiene cláusula `WHEN`. Todos se disparan para CADA operación. El filtrado se hace en los escenarios de Make.com.

### 1.3 Raíz del problema: demasiados caminos para hacer lo mismo

Actualmente coexisten **cuatro mecanismos** para aprobar y enviar una respuesta IA:

| Camino | Flujo | Estado |
|--------|-------|--------|
| **A** Frontend directo | updateAi() → UPDATE ai_interaction + fetch(APPROVE_WEBHOOK) → Make crea interacción | ACTIVO |
| **B** Edge Function | dispatch_approved endpoint → fetch(APPROVE_WEBHOOK) → Make crea interacción | EXISTE pero no se usa |
| **C** RPC approve_interaction | Valida → UPDATE status → pg_net webhook | EXISTE pero asume interacción ya creada |
| **D** Google Sheets | Make lee hoja → crea interacción | LEGACY, activo en paralelo |

---

## 2. PRINCIPIOS DE DISEÑO

1. **El frontend solo habla con la base de datos.** Consistente con cómo ya funciona `sendMessage()`.
2. **La base de datos es la fuente de verdad.** Operaciones atómicas en PostgreSQL.
3. **Los triggers disparan Make.com.** Make orquesta el envío real.
4. **Un solo camino por operación.** No más caminos paralelos.
5. **Idempotencia.** Aprobar dos veces no crea dos interacciones.

---

## 3. SOLUCIÓN PROPUESTA

### 3.1 Diagrama del nuevo flujo

```
APROBAR:
  Frontend                    PostgreSQL                     Make.com
  ────────                    ──────────                     ────────
  Click ✓ Aprobar
      │
      └─▶ RPC approve_ai_response(ai_id)
              │
              ├── Valida: evaluation='pending'?
              ├── Valida: ya tiene generated_id? → retorna éxito (idempotente)
              ├── Busca system_conversation_id
              ├── INSERT interactions (status='pending_delivery', texto=response)
              ├── UPDATE ai_interaction (evaluation='approved', generated_interaction_id)
              └── COMMIT
                    │
                    └── TRIGGER New_pending_delivery_and_send
                              └──▶ Dispatcher → [OUT] → API Meta → ENVIADO


RECHAZAR:
  Frontend                    PostgreSQL
  ────────                    ──────────
  Click ✗ Rechazar
      │
      └─▶ RPC reject_ai_response(ai_id)
              │
              ├── UPDATE ai_interaction SET evaluation='confictive'
              └── COMMIT (sin trigger, sin interacción, sin envío)
```

### 3.2 Función RPC `approve_ai_response`

```sql
CREATE OR REPLACE FUNCTION public.approve_ai_response(p_ai_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ai RECORD; v_sc_id integer; v_new_int_id integer; v_deadline_ok boolean;
BEGIN
  SELECT ai.id, ai.evaluation, ai.generated_interaction_id, ai.response,
         i.time_stamp as original_time, i.id_person_conversation
  INTO v_ai FROM ai_interaction ai
  JOIN interactions i ON i.id = ai.associated_interaction_id
  WHERE ai.id = p_ai_id FOR UPDATE OF ai;

  IF NOT FOUND THEN RETURN '{"ok":false,"error":"not_found"}'::jsonb; END IF;
  IF v_ai.evaluation = 'approved' AND v_ai.generated_interaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true,
      'generated_interaction_id', v_ai.generated_interaction_id);
  END IF;
  IF v_ai.evaluation IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;
  IF v_ai.response IS NULL OR v_ai.response = '' THEN
    RETURN '{"ok":false,"error":"empty_response"}'::jsonb;
  END IF;

  v_deadline_ok := (now() - v_ai.original_time) < interval '24 hours';

  SELECT sc.id INTO v_sc_id FROM person_conversation pc
  JOIN system_conversation sc ON sc.id_conversation = pc.id_conversation
  WHERE pc.id = v_ai.id_person_conversation;
  IF v_sc_id IS NULL THEN RETURN '{"ok":false,"error":"no_system_conversation"}'::jsonb; END IF;

  INSERT INTO interactions (id_system_conversation, text, time_stamp, status)
  VALUES (v_sc_id, v_ai.response, now(),
    CASE WHEN v_deadline_ok THEN 'pending_delivery' ELSE 'preprocessed' END)
  RETURNING id INTO v_new_int_id;

  UPDATE ai_interaction SET evaluation = 'approved', generated_interaction_id = v_new_int_id
  WHERE id = p_ai_id;

  RETURN jsonb_build_object('ok', true, 'generated_interaction_id', v_new_int_id,
    'deadline_ok', v_deadline_ok);
END; $$;
```

### 3.3 Función RPC `reject_ai_response`

```sql
CREATE OR REPLACE FUNCTION public.reject_ai_response(p_ai_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_current_eval text;
BEGIN
  SELECT evaluation::text INTO v_current_eval FROM ai_interaction WHERE id = p_ai_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"error":"not_found"}'::jsonb; END IF;
  IF v_current_eval = 'confictive' THEN RETURN '{"ok":true,"already_done":true}'::jsonb; END IF;
  IF v_current_eval IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;
  UPDATE ai_interaction SET evaluation = 'confictive' WHERE id = p_ai_id;
  RETURN '{"ok":true}'::jsonb;
END; $$;
```

---

## 4. PLAN DE IMPLEMENTACIÓN

| Fase | Acción | Riesgo | Rollback |
|------|--------|--------|----------|
| 1 | Crear RPCs en Supabase | Bajo — nadie las llama hasta actualizar frontend | DROP FUNCTION |
| 2 | Actualizar frontend (eliminar webhook, usar RPCs) | Bajo — testeable en localhost | git revert |
| 3 | Desactivar escenario Approve & Dispatch (4168577) en Make | Bajo — reactivable | Reactivar |
| 4 | Limpiar Edge Function (eliminar dispatch_approved) | Nulo | Redeploy versión anterior |
| 5 | Eliminar RPC vieja (approve_interaction) | Nulo | Recrear |

---

## 5. QUÉ NO SE TOCA

- Escenarios de entrada, procesamiento, preprocesamiento, generación IA
- Google Sheets records (3502129) — sigue registrando
- Dispatcher (4124755) — sigue despachando
- Sending messages y escenarios [OUT] — sin cambios
- Triggers existentes en interactions — sin cambios

---

## 6. TABLA COMPARATIVA

| Aspecto | Antes | Después |
|---------|-------|---------|
| Caminos de aprobación | 4 | 1 (RPC) |
| Protección doble-click | useState (async, falible) | useRef (sync) + FOR UPDATE en DB |
| Protección duplicados | Ninguna | generated_interaction_id check |
| Rechazar crea interacción? | Posiblemente sí | No |
| Latencia de aprobación | 3-5s (via Make) | <500ms (RPC directo) |
| Operaciones Make extra/aprobación | 2 | 0 |

---

## 9. RESUMEN

**El frontend escribe en la base de datos. La base de datos notifica a Make. Make envía mensajes.**

Mismo patrón que `sendMessage()`. Sin desvíos por Make.com. Sin duplicados. Sin rechazos enviados.
