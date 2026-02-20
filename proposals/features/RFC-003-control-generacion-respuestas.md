# RFC-003: Control de generacion de respuestas por persona/conversacion

- **Fecha de creacion:** 2026-02-20
- **Ultima actualizacion:** 2026-02-20
- **Estado:** en_discusion
- **Prioridad:** P1
- **Autor original:** gviollaz + Claude Opus 4.6 (Claude Code)
- **Componentes afectados:** Frontend, Supabase DB, Make.com, Edge Functions
- **Ref FEAT:** Nuevo (propuesto como FEAT-018)
- **Ref Roadmap:** No asignado todavia

---

## Resumen ejecutivo

Actualmente no hay forma de desactivar la generacion de respuestas IA para un cliente especifico. Cuando un alumno ya compro y pasa a gestion manual, o cuando un operador toma una conversacion personalmente, la IA sigue generando respuestas que nadie usa y que incluso pueden interferir con la comunicacion manual. Necesitamos controles para pausar o desactivar la IA por persona, conversacion o canal, de forma temporal o permanente.

## Problema

### Situacion actual

1. Cada mensaje entrante genera una respuesta IA automaticamente, **sin excepciones**.
2. Cuando un alumno ya esta inscripto y se comunica por temas administrativos (pagos, certificados), la IA genera respuestas comerciales irrelevantes.
3. Cuando un operador toma una conversacion manualmente desde el telefono, la IA sigue generando respuestas que se acumulan como `pending` en `ai_interaction`.
4. No hay boton en el CRM para decir "no generes mas IA para este contacto".
5. La unica forma actual de evitarlo es rechazar (`confictive`) cada respuesta manualmente — tedioso y no previene la generacion.

### Casos de uso que necesitan control

| Caso | Duracion | Ejemplo |
|------|----------|---------|
| Alumno inscripto, gestion manual | Permanente | "Ya pago, ahora le mandamos info de clase por WA directo" |
| Conversacion tomada por operador | Temporal (esa conversacion) | "Estoy hablando yo con este cliente, que la IA no interfiera" |
| Horario de atencion manual | Temporal (horario) | "De 9 a 18 atendemos humanos, de noche la IA" |
| Lead que pidio no recibir mensajes | Permanente | "No me manden mas mensajes automaticos" |
| Conversacion de soporte tecnico | Temporal (esa conversacion) | "Es un problema tecnico, la IA no sabe resolver esto" |

## Solucion propuesta

### Opcion A: Flag por persona + flag por conversacion (recomendada)

Agregar flags de control a dos niveles: persona y conversacion. Make.com los consulta antes de generar respuesta IA.

**Niveles de control:**
```
Persona: ai_enabled = true/false (global para esa persona)
  └─ Conversacion: ai_enabled = true/false (override por conversacion)
     └─ Temporal: ai_paused_until = TIMESTAMPTZ (pausa con fecha de vencimiento)
```

**Logica de decision:**
```
Si persona.ai_enabled = false → NO generar IA (permanente)
Si conversacion.ai_enabled = false → NO generar IA (permanente para esa conversacion)
Si conversacion.ai_paused_until > NOW() → NO generar IA (temporal)
En cualquier otro caso → Generar IA normalmente
```

- **Pros:** Flexible, cubre todos los casos. Facil de consultar en Make.com.
- **Contras:** Requiere cambios en DB, frontend y Make.com.
- **Esfuerzo:** Medio (1 semana)
- **Impacto:** Alto — control granular que los operadores necesitan.

### Opcion B: Solo flag por persona

Mas simple, solo un toggle a nivel persona.

- **Pros:** Implementacion simple.
- **Contras:** No permite pausar conversaciones individuales. Todo o nada.
- **Esfuerzo:** Bajo (2-3 dias)
- **Impacto:** Medio

### Opcion C: Etiquetas/tags con reglas

Sistema de tags que se asignan a personas y que disparan reglas (ej: tag "manual" → no generar IA).

- **Pros:** Muy flexible, extensible.
- **Contras:** Sobre-ingenieria para la necesidad actual.
- **Esfuerzo:** Alto (2-3 semanas)
- **Impacto:** Alto pero excesivo para el problema actual.

## Diseno tecnico

### Cambios en base de datos

```sql
-- Flag a nivel persona
ALTER TABLE persons ADD COLUMN ai_enabled BOOLEAN DEFAULT true;
ALTER TABLE persons ADD COLUMN ai_disabled_reason TEXT; -- motivo de desactivacion
ALTER TABLE persons ADD COLUMN ai_disabled_at TIMESTAMPTZ;
ALTER TABLE persons ADD COLUMN ai_disabled_by TEXT; -- quien lo desactivo (operador, sistema)

-- Flag a nivel conversacion
ALTER TABLE conversations ADD COLUMN ai_enabled BOOLEAN DEFAULT true;
ALTER TABLE conversations ADD COLUMN ai_paused_until TIMESTAMPTZ; -- pausa temporal
ALTER TABLE conversations ADD COLUMN ai_paused_reason TEXT;

-- Funcion que Make.com consulta antes de generar IA
CREATE OR REPLACE FUNCTION should_generate_ai_response(p_conversation_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_person_ai_enabled BOOLEAN;
  v_conv_ai_enabled BOOLEAN;
  v_conv_paused_until TIMESTAMPTZ;
BEGIN
  -- Verificar flag de persona
  SELECT p.ai_enabled INTO v_person_ai_enabled
  FROM persons p
  JOIN person_conversation pc ON pc.person_id = p.id
  WHERE pc.conversation_id = p_conversation_id
  LIMIT 1;

  IF v_person_ai_enabled = false THEN
    RETURN false;
  END IF;

  -- Verificar flag de conversacion
  SELECT c.ai_enabled, c.ai_paused_until
  INTO v_conv_ai_enabled, v_conv_paused_until
  FROM conversations c
  WHERE c.id = p_conversation_id;

  IF v_conv_ai_enabled = false THEN
    RETURN false;
  END IF;

  -- Verificar pausa temporal
  IF v_conv_paused_until IS NOT NULL AND v_conv_paused_until > NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
```

### Cambios en Make.com

**En Etapa 4 (Generacion IA) — agregar paso previo:**

1. Antes de llamar a la API de IA, llamar a `should_generate_ai_response(conversation_id)`.
2. Si devuelve `false`, saltar toda la generacion.
3. Opcionalmente, registrar que se omitio la generacion (para stats).

**Escenarios afectados:** Todos los que generan respuesta IA (WA Cloud API, WA Coexistence, Instagram, Messenger).

### Cambios en Edge Functions

```typescript
// Nuevo endpoint en crm-api
if (endpoint === "toggle_ai_person") {
  // POST: { person_id, enabled: true/false, reason: "..." }
  const { person_id, enabled, reason } = body;
  await sb.from('persons').update({
    ai_enabled: enabled,
    ai_disabled_reason: enabled ? null : reason,
    ai_disabled_at: enabled ? null : new Date().toISOString(),
    ai_disabled_by: 'crm_operator'
  }).eq('id', person_id);
  return json({ ok: true });
}

if (endpoint === "toggle_ai_conversation") {
  // POST: { conversation_id, enabled: true/false, paused_hours: null|number, reason: "..." }
  const { conversation_id, enabled, paused_hours, reason } = body;
  const updates = { ai_enabled: enabled, ai_paused_reason: reason };
  if (paused_hours) {
    updates.ai_paused_until = new Date(Date.now() + paused_hours * 3600000).toISOString();
    updates.ai_enabled = true; // si es pausa temporal, el flag queda en true
  }
  await sb.from('conversations').update(updates).eq('id', conversation_id);
  return json({ ok: true });
}
```

### Cambios en frontend

**En Conversations.jsx — panel de chat:**
```jsx
// Boton en la barra superior del chat abierto:
// "🤖 IA Activa" (toggle verde/rojo)
// Al hacer click: opciones
//   - "Pausar IA 1 hora"
//   - "Pausar IA 24 horas"
//   - "Desactivar IA para esta conversacion"
//   - "Desactivar IA para esta persona (todas las conversaciones)"

// Indicador visual cuando la IA esta desactivada:
// Banner amarillo: "⚠️ IA desactivada para esta conversacion (por operador, hace 2h)"
// Banner rojo: "🚫 IA desactivada permanentemente para esta persona. Motivo: cliente inscripto"
```

**En People.jsx — perfil de persona:**
```jsx
// Toggle de IA en el perfil:
// "Generacion de respuestas IA: ✅ Activo / ❌ Desactivado"
// Campo de motivo si esta desactivado
// Boton para reactivar
```

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | Agregar campos `ai_enabled` a `persons` y `conversations` | Supabase DB | 1 hora |
| 2 | Crear funcion `should_generate_ai_response()` | Supabase DB | 1 hora |
| 3 | Agregar endpoints `toggle_ai_person` y `toggle_ai_conversation` | Edge Functions | 2 horas |
| 4 | Modificar escenarios de Make.com para consultar flag | Make.com | 1 dia |
| 5 | UI toggle en Conversations.jsx (boton + opciones de pausa) | Frontend | 1 dia |
| 6 | UI toggle en People.jsx (perfil de persona) | Frontend | 4 horas |
| 7 | Indicadores visuales (banners de IA desactivada) | Frontend | 4 horas |
| 8 | Testeo end-to-end | Todos | 1 dia |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Operador desactiva IA y se olvida de reactivar | Medio | Usar pausa temporal por defecto. Alerta en dashboard si hay personas con IA desactivada hace mucho. |
| Make.com no consulta el flag correctamente | Alto | Testear con datos reales. Agregar logging cuando se omite generacion. |
| Rendimiento: consulta extra por cada mensaje | Bajo | La funcion SQL es simple (2 queries por PK). No afecta rendimiento. |
| Persona desactivada recibe nuevo mensaje urgente | Bajo | Dashboard muestra conversaciones con IA desactivada para revision manual. |

## Criterios de aceptacion

- [ ] Boton de toggle IA visible en panel de conversacion
- [ ] Pausa temporal funcional (1h, 24h) con vencimiento automatico
- [ ] Desactivacion permanente por persona funcional desde perfil
- [ ] Make.com NO genera IA cuando esta desactivada
- [ ] Indicadores visuales claros cuando la IA esta pausada/desactivada
- [ ] Se registra quien desactivo y por que motivo

## Dependencias

- **Requiere:** Nada especifico, puede implementarse en cualquier momento
- **Ideal:** Antes de RFC-002 (auto-aprobacion) para tener control manual + automatico combinados
- **Bloquea:** Nada directamente

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### 2026-02-20 - gviollaz

Caso de uso principal: cuando un alumno ya compro un curso y pasa a gestion manual. Los operadores se quejan de que la IA sigue generando respuestas comerciales para gente que ya es alumno. Necesitamos el toggle a nivel persona como minimo. La pausa temporal por conversacion es un bonus muy util.

### 2026-02-20 - Claude Opus 4.6 (Claude Code)

Coincido con la Opcion A. Es la mas practica y cubre todos los casos mencionados. La funcion `should_generate_ai_response()` es clave porque centraliza la logica y permite que Make.com la consulte sin conocer todos los flags.

Dato adicional: Esto se complementa perfectamente con RFC-002. Si un operador toma una conversacion, puede pausar la IA temporalmente. Y si la conversacion tiene auto-aprobacion activa, la pausa la desactiva para esa conversacion.

Pregunta para el equipo: Cuando una persona se desactiva, que pasa con las respuestas `pending` que ya estan generadas? Opciones:
1. Se cancelan automaticamente (nuevo estado `cancelled`)
2. Se dejan como estan para que el operador las descarte manualmente
3. Se marcan como `expired` despues de X horas

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-02-20 | Claude Opus 4.6 | Creacion del RFC |
| 2026-02-20 | gviollaz | Contexto de negocio y caso de uso principal |
