# RFC-005: Alertas de ventana de 24hs y seguimiento proactivo

- **Fecha de creacion:** 2026-02-20
- **Ultima actualizacion:** 2026-02-20
- **Estado:** en_discusion
- **Prioridad:** P1
- **Autor original:** gviollaz + Claude Opus 4.6 (Claude Code)
- **Componentes afectados:** Frontend, Supabase DB, Make.com, Edge Functions
- **Ref FEAT:** Nuevo (propuesto como FEAT-020)
- **Ref Roadmap:** No asignado todavia

---

## Resumen ejecutivo

WhatsApp y Messenger tienen una regla estricta: si no respondemos dentro de las 24 horas desde el ultimo mensaje del usuario, perdemos la capacidad de enviarle mensajes de texto libre. Despues de ese plazo, solo podemos contactarlo con Message Templates (WA) o Message Tags (Messenger), que son limitados y costosos. Hoy no hay forma de saber que conversaciones estan por vencer. Proponemos un sistema de alertas que avise cuando una conversacion se acerca al limite de 24hs y sugiera mensajes de seguimiento para mantener la ventana abierta.

## Problema

### La regla de la ventana de 24hs

```
Usuario escribe                    +24h
    |                               |
    |<-- VENTANA ABIERTA ---------->|<-- VENTANA CERRADA -->
    |  Podemos enviar texto libre   |  Solo templates/tags
    |  Costo: $0 (WA Business)     |  Costo: ~$0.05-0.15/msg
    |                               |
    |  Si respondemos, la ventana   |  Si el usuario escribe
    |  se renueva desde nuestra     |  de nuevo, se reabre
    |  respuesta                    |
```

### Situacion actual

1. **No hay visibilidad** de cuales conversaciones estan por vencer su ventana de 24hs.
2. Cuando la ventana vence, perdemos la capacidad de responder gratis.
3. Muchas conversaciones de venta se pierden porque no respondimos a tiempo y luego no podemos recontactar sin template.
4. Los operadores no tienen forma de saber a que conversaciones priorizar.

### Datos de produccion

- **24K conversaciones** en la DB.
- Las conversaciones activas (con mensajes en los ultimos 7 dias) estan en la pagina de Health:
  - Instagram Salta: 231 msgs entrantes en 7 dias
  - Messenger Salta: 37 msgs entrantes en 7 dias
  - WA San Lorenzo: 17 msgs entrantes en 7 dias
  - WA Cloud API: 8 msgs entrantes en 7 dias
- **Estimacion:** En un dia promedio hay ~50-80 conversaciones activas. De esas, ~15-20 podrian estar acercandose al limite de 24hs.

### Costo de no actuar

| Escenario | Costo |
|-----------|-------|
| Conversacion que vence sin responder | Lead perdido o costo de template WA (~$0.05-0.15) |
| Lead de alto valor que vence | Venta perdida (valor variable, potencialmente alto) |
| Acumulacion de leads frios | Necesidad de campana de recontacto (RFC-004, mas costo) |

## Solucion propuesta

### Tres componentes complementarios

#### 1. Panel de alertas en el CRM (frontend)

Mostrar en la pagina de Conversaciones (o en una seccion dedicada) las conversaciones que estan por vencer, ordenadas por urgencia.

**Categorias:**
```
🔴 CRITICO (< 2h para vencer): 3 conversaciones
🟡 URGENTE (2-10h para vencer): 8 conversaciones
🟢 OK (> 10h o ventana abierta): 45 conversaciones
⚫ VENCIDA (ventana cerrada): 12 conversaciones
```

Cada conversacion muestra:
- Nombre de la persona
- Canal
- Ultimo mensaje (resumen)
- Tiempo restante de ventana ("vence en 1h 23m")
- Boton: "Enviar seguimiento" → sugiere mensaje de seguimiento

#### 2. Sugerencia automatica de seguimiento

Cuando una conversacion esta en zona critica (< 2-4 horas), el sistema genera automaticamente un mensaje de seguimiento contextualizado:

```
Ejemplo:
Persona: Juan Perez
Ultimo mensaje (hace 22h): "Cuanto sale el curso de Node.js?"
IA pendiente: Respuesta con informacion del curso

Sugerencia de seguimiento:
"Hola Juan! Te comparto la info del curso de Node.js que consultaste.
[respuesta IA pendiente]. Quedamos a disposicion por cualquier duda!"
```

La sugerencia puede ser:
- **Aprobar la IA pendiente** si hay una → enviarla antes de que venza
- **Generar nuevo mensaje** de seguimiento si no hay IA pendiente
- **Usar template** si la ventana ya vencio

#### 3. Monitoreo automatico (Make.com)

Escenario que corre cada hora, revisa conversaciones por vencer, y notifica.

### Opcion A: Panel en frontend + notificaciones (recomendada)

- **Pros:** Visibilidad inmediata, control del operador, integrado con el chat existente.
- **Contras:** Requiere que el operador mire el CRM. No funciona si nadie esta mirando.
- **Esfuerzo:** Medio (1-2 semanas)
- **Impacto:** Alto

### Opcion B: Automatizacion completa

Cuando una conversacion esta a < 2h de vencer, auto-aprobar la IA pendiente y enviarla automaticamente.

- **Pros:** No requiere intervencion humana.
- **Contras:** Riesgo de enviar respuestas inadecuadas. Requiere RFC-002 (auto-aprobacion) funcionando.
- **Esfuerzo:** Medio (depende de RFC-002)
- **Impacto:** Critico pero riesgoso

### Opcion C: Solo notificaciones externas

Enviar alerta por email/WA al operador cuando hay conversaciones por vencer.

- **Pros:** Simple, funciona aunque nadie mire el CRM.
- **Contras:** No integrado con el CRM, no muestra contexto.
- **Esfuerzo:** Bajo (3-5 dias)
- **Impacto:** Bajo-Medio

## Diseno tecnico

### Cambios en base de datos

```sql
-- Funcion que calcula estado de ventana para todas las conversaciones activas
CREATE OR REPLACE FUNCTION get_window_status()
RETURNS TABLE(
  conversation_id BIGINT,
  person_id BIGINT,
  person_name TEXT,
  channel_id INTEGER,
  channel_name TEXT,
  provider TEXT,
  last_person_msg TIMESTAMPTZ,     -- ultimo mensaje del usuario
  last_system_msg TIMESTAMPTZ,     -- ultimo mensaje nuestro
  window_expires_at TIMESTAMPTZ,   -- cuando vence la ventana
  minutes_remaining INTEGER,        -- minutos restantes
  window_status TEXT,               -- critical, urgent, ok, expired
  has_pending_ai BOOLEAN,          -- tiene respuesta IA sin aprobar
  pending_ai_id INTEGER,           -- id de la respuesta IA pendiente
  last_message_preview TEXT        -- preview del ultimo mensaje
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_convos AS (
    SELECT DISTINCT
      c.id AS conversation_id,
      pc.person_id,
      COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS person_name,
      sc.channel_id,
      ch.name AS channel_name,
      cp.provider,
      -- Ultimo mensaje entrante (del usuario)
      (SELECT MAX(i.time_stamp)
       FROM interactions i
       WHERE i.id_person_conversation = pc.id) AS last_person_msg,
      -- Ultimo mensaje saliente (nuestro)
      (SELECT MAX(i.time_stamp)
       FROM interactions i
       JOIN system_conversation sc2 ON sc2.id = i.id_system_conversation
       WHERE sc2.conversation_id = c.id) AS last_system_msg,
      -- Respuesta IA pendiente
      (SELECT ai.id
       FROM ai_interaction ai
       JOIN interactions i ON i.id = ai.interaction_id
       WHERE i.id_person_conversation = pc.id
         AND ai.evaluation = 'pending'
       ORDER BY ai.created_at DESC LIMIT 1) AS pending_ai_id,
      -- Preview del ultimo mensaje
      (SELECT LEFT(i.body, 100)
       FROM interactions i
       WHERE i.id_person_conversation = pc.id
       ORDER BY i.time_stamp DESC LIMIT 1) AS last_message_preview
    FROM conversations c
    JOIN person_conversation pc ON pc.conversation_id = c.id
    JOIN system_conversation sc ON sc.conversation_id = c.id
    JOIN channels ch ON ch.id = sc.channel_id
    JOIN channel_providers cp ON cp.id = ch.channel_provider_id
    JOIN persons p ON p.id = pc.person_id
    WHERE cp.provider IN ('whatsapp', 'whatsapp cloud api', 'messenger', 'instagram')
  )
  SELECT
    ac.conversation_id,
    ac.person_id,
    ac.person_name,
    ac.channel_id,
    ac.channel_name,
    ac.provider,
    ac.last_person_msg,
    ac.last_system_msg,
    ac.last_person_msg + INTERVAL '24 hours' AS window_expires_at,
    EXTRACT(EPOCH FROM (ac.last_person_msg + INTERVAL '24 hours' - NOW()))::INTEGER / 60 AS minutes_remaining,
    CASE
      WHEN ac.last_person_msg IS NULL THEN 'expired'
      WHEN ac.last_person_msg + INTERVAL '24 hours' < NOW() THEN 'expired'
      WHEN ac.last_person_msg + INTERVAL '22 hours' < NOW() THEN 'critical'  -- < 2h
      WHEN ac.last_person_msg + INTERVAL '14 hours' < NOW() THEN 'urgent'    -- 2-10h
      ELSE 'ok'
    END AS window_status,
    ac.pending_ai_id IS NOT NULL AS has_pending_ai,
    ac.pending_ai_id,
    ac.last_message_preview
  FROM active_convos ac
  WHERE ac.last_person_msg > NOW() - INTERVAL '48 hours' -- solo ultimas 48h
  ORDER BY
    CASE
      WHEN ac.last_person_msg + INTERVAL '24 hours' < NOW() THEN 4
      WHEN ac.last_person_msg + INTERVAL '22 hours' < NOW() THEN 1
      WHEN ac.last_person_msg + INTERVAL '14 hours' < NOW() THEN 2
      ELSE 3
    END,
    ac.last_person_msg ASC; -- las mas viejas primero dentro de cada categoria
END;
$$;
```

### Cambios en Edge Functions

```typescript
// Endpoint de alertas de ventana
if (endpoint === "window_alerts") {
  const { data, error } = await sb.rpc('get_window_status');
  if (error) return json({ error: error.message }, 400);

  // Agrupar por status
  const grouped = {
    critical: data.filter(d => d.window_status === 'critical'),
    urgent: data.filter(d => d.window_status === 'urgent'),
    ok: data.filter(d => d.window_status === 'ok'),
    expired: data.filter(d => d.window_status === 'expired'),
    summary: {
      critical: data.filter(d => d.window_status === 'critical').length,
      urgent: data.filter(d => d.window_status === 'urgent').length,
      ok: data.filter(d => d.window_status === 'ok').length,
      expired: data.filter(d => d.window_status === 'expired').length,
    }
  };
  return json({ data: grouped });
}

// Endpoint para sugerir seguimiento
if (endpoint === "suggest_followup") {
  // Recibe conversation_id
  // Si hay IA pendiente: sugiere aprobar esa IA
  // Si no hay IA: genera un mensaje de seguimiento contextualizado
}
```

### Cambios en frontend

**Opcion 1: Seccion en Conversations.jsx**

Agregar un banner/panel superior que muestre el resumen de alertas:

```jsx
// Banner de alertas en la parte superior de Conversations
function WindowAlerts({ alerts }) {
  if (!alerts || alerts.summary.critical === 0 && alerts.summary.urgent === 0) return null;

  return (
    <div style={{ padding: '8px 16px', background: 'var(--redBg)', borderBottom: '1px solid var(--red)' }}>
      <span>⚠️ Ventanas por vencer: </span>
      {alerts.summary.critical > 0 && <Badge c="red">{alerts.summary.critical} criticas (< 2h)</Badge>}
      {alerts.summary.urgent > 0 && <Badge c="yellow">{alerts.summary.urgent} urgentes (2-10h)</Badge>}
      <Btn size="sm" onClick={() => setFilter('window_critical')}>Ver</Btn>
    </div>
  );
}
```

**Opcion 2: Seccion en Health.jsx**

Agregar un bloque de "Ventanas de conversacion" debajo de los canales.

**Opcion 3: Nueva pagina dedicada (si el volumen lo justifica)**

### Cambios en Make.com

**Nuevo escenario: "Window Alert Monitor"**

Corre cada hora:
1. Llamar a `get_window_status()` filtrando solo `critical`.
2. Si hay conversaciones criticas con IA pendiente:
   - Opcion conservadora: Enviar notificacion al operador (email/WA)
   - Opcion agresiva: Auto-aprobar la IA pendiente (requiere RFC-002)
3. Registrar en log las alertas generadas.

**Escenario de seguimiento automatico (futuro, post-RFC-002):**
1. Cuando una conversacion entra en zona critica (< 2h)
2. Si tiene respuesta IA con score >= 90 (RFC-002)
3. Auto-aprobar y enviar
4. Si no tiene IA pendiente, generar mensaje de seguimiento y enviar

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | Crear funcion `get_window_status()` | Supabase DB | 2 horas |
| 2 | Endpoint `window_alerts` en crm-api | Edge Functions | 1 hora |
| 3 | Banner de alertas en Conversations.jsx | Frontend | 1 dia |
| 4 | Filtro "conversaciones por vencer" en lista de conversaciones | Frontend | 4 horas |
| 5 | Vista detallada de conversacion critica con accion rapida | Frontend | 1 dia |
| 6 | Auto-refresh de alertas cada 5 minutos | Frontend | 1 hora |
| 7 | Escenario "Window Alert Monitor" en Make.com | Make.com | 1 dia |
| 8 | (Futuro) Integracion con RFC-002 para auto-aprobacion | Make.com | 1-2 dias |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Consulta SQL pesada (recorre muchas interacciones) | Medio | Limitar a conversaciones de ultimas 48h. Indice en `time_stamp`. |
| Falsos positivos (la ventana ya se renovo y no lo detectamos) | Bajo | Calcular desde `last_person_msg` real, no estimado. |
| Sobrecarga de alertas (muchas conversaciones criticas) | Medio | Priorizar por valor del lead. Mostrar solo top 10 mas criticas. |
| Operador ignora las alertas | Medio | Notificacion externa (email/WA) para criticas. Estadistica de ventanas perdidas. |
| Auto-seguimiento envia mensaje inadecuado | Alto | Empezar solo con alertas visuales. Auto-seguimiento solo despues de RFC-002 validado. |

## Criterios de aceptacion

- [ ] Banner visible en Conversations cuando hay conversaciones criticas
- [ ] Conteo de conversaciones por status de ventana (critica/urgente/ok/vencida)
- [ ] Click en alerta lleva a la conversacion
- [ ] Accion rapida: "Aprobar IA pendiente" desde la alerta
- [ ] Auto-refresh cada 5 minutos
- [ ] Solo canales con restriccion de ventana (WA, IG, Messenger — no email)

## Dependencias

- **Requiere:** Nada especifico, puede implementarse ahora
- **Mejora con:** RFC-002 (auto-aprobacion para auto-seguimiento)
- **Mejora con:** RFC-003 (no alertar sobre personas con IA desactivada)
- **Complementa:** RFC-004 (campanas — saber cuantos leads tienen ventana abierta para elegir canal)
- **Bloquea:** Nada directamente

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### 2026-02-20 - gviollaz

Este es uno de los features mas urgentes. Veo que muchas conversaciones se caen porque no respondimos a tiempo. Especialmente en Instagram donde el volumen es alto (231 msgs/semana en Salta) y las noches/fines de semana son el punto debil.

Caso concreto: un lead pregunta por un curso el viernes a las 20:00. El operador no esta. La IA genera respuesta pero queda pendiente. El sabado a las 20:00 la ventana vence. El lunes cuando el operador llega, ya no puede responder gratis.

Prioridad: empezar con el panel de alertas visuales. Si despues combinamos con RFC-002 (auto-aprobacion) para los horarios fuera de oficina, resolvemos el 80% del problema.

### 2026-02-20 - Claude Opus 4.6 (Claude Code)

El caso del viernes 20:00 es critico y muy comun. La combinacion RFC-005 + RFC-002 resolveria asi:

1. Viernes 20:00: llega mensaje, IA genera respuesta, evaluador le da score 92.
2. Como es fuera de horario Y score alto → auto-aprobada y enviada.
3. Ventana se mantiene abierta (respondimos dentro de 24h).
4. Lunes el operador ve en el historial que la IA respondio automaticamente.

Sin RFC-002, al menos RFC-005 alertaria al operador si hay alguien mirando el CRM:

1. Viernes 20:00: llega mensaje.
2. Sabado 16:00 (6h para vencer): alerta 🟡 URGENTE en el CRM.
3. Sabado 18:00 (2h para vencer): alerta 🔴 CRITICO.
4. Si alguien mira el CRM: puede aprobar la IA con un click.

Pregunta para discusion: deberiamos agregar la opcion de que el alerta envie una notificacion por email o WhatsApp al operador cuando una conversacion entra en zona critica? Eso no requiere RFC-002 y resolveria el problema de "nadie esta mirando el CRM".

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-02-20 | Claude Opus 4.6 | Creacion del RFC |
| 2026-02-20 | gviollaz | Contexto de negocio, caso de uso del viernes |
