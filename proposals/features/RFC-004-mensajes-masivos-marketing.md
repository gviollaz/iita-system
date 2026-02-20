# RFC-004: Mensajes masivos de marketing multicanal

- **Fecha de creacion:** 2026-02-20
- **Ultima actualizacion:** 2026-02-20
- **Estado:** en_discusion
- **Prioridad:** P2
- **Autor original:** gviollaz + Claude Opus 4.6 (Claude Code)
- **Componentes afectados:** Frontend (nueva pagina), Supabase DB (tablas nuevas), Make.com (escenarios nuevos)
- **Ref FEAT:** Nuevo (propuesto como FEAT-019)
- **Ref Roadmap:** No asignado todavia

---

## Resumen ejecutivo

Actualmente el sistema solo procesa mensajes **reactivos** (alguien nos escribe, la IA responde). No hay forma de enviar mensajes **proactivos** de marketing: avisar sobre un nuevo curso, recordar una fecha de inscripcion, o recontactar leads frios. Cada canal tiene reglas diferentes (WhatsApp requiere templates fuera de ventana de 24hs, Instagram/Messenger tienen sus propias restricciones, email no tiene ventana). Proponemos un modulo de campanas de marketing que respete las reglas de cada canal y permita envios masivos segmentados.

## Problema

### Situacion actual

1. **No hay forma de enviar mensajes masivos desde el CRM.** Para hacer marketing, los operadores envian mensajes uno por uno desde el telefono o usan herramientas externas.
2. **25K personas en la DB** pero sin forma de contactarlas proactivamente.
3. Los datos enriquecidos (`person_soft_data`) tienen informacion de interes, ubicacion, nivel educativo — datos ideales para segmentacion pero que no se usan para marketing.
4. **No se respetan las restricciones por canal**, lo que puede resultar en bloqueo de cuentas (especialmente WhatsApp).

### Restricciones por canal

| Canal | Restriccion | Solucion |
|-------|------------|----------|
| **WhatsApp Cloud API** | Fuera de ventana de 24hs, solo se puede enviar con **Message Templates** pre-aprobados por Meta. Dentro de ventana, se puede enviar texto libre. | Usar templates para marketing, texto libre para seguimiento dentro de ventana |
| **WhatsApp Coexistence** | Similar a Cloud API pero via provider Coexistence. Templates deben registrarse por separado. | Misma estrategia pero con API diferente |
| **Instagram** | Solo se puede enviar a usuarios que interactuaron primero. No hay "broadcast". Ventana de 24hs. | Solo recontacto dentro de ventana. Para marketing: stories/posts (fuera del CRM). |
| **Messenger** | Ventana de 24hs para mensajes regulares. Para mensajes fuera de ventana: "Message Tags" (categorias limitadas). | Usar tags para notificaciones legitimas, no marketing puro. |
| **Email** | Sin restriccion de ventana. Requiere cumplir con leyes anti-spam (CAN-SPAM, etc.). Necesita opcion de unsuscribe. | Envio libre con opt-out obligatorio |

### Tipos de campana necesarios

1. **Anuncio de nuevo curso:** "Abrimos inscripcion para [curso]. Cupo limitado."
2. **Recordatorio de inscripcion:** "Ultima semana para inscribirte en [curso]."
3. **Recontacto de leads frios:** "Hola [nombre], hace tiempo que no sabemos de vos..."
4. **Notificacion a alumnos:** "Recordatorio: manana empieza [curso], [horario]."
5. **Promocion:** "20% de descuento en [curso] si te inscribis esta semana."

## Solucion propuesta

### Opcion A: Modulo de campanas completo (recomendada)

Nueva seccion en el CRM para crear, segmentar, enviar y trackear campanas de marketing.

**Flujo:**
```
Crear campana → Definir audiencia (filtros) → Elegir canal y formato → Previsualizar → Programar o enviar → Trackear resultados
```

- **Pros:** Solucion completa, profesional. Segmentacion usando datos enriquecidos.
- **Contras:** Esfuerzo alto. Requiere templates de WhatsApp pre-aprobados.
- **Esfuerzo:** Alto (3-4 semanas)
- **Impacto:** Critico — habilita marketing proactivo para 25K personas.

### Opcion B: Envio rapido sin campanas formales

Boton en la lista de personas: "Enviar mensaje a seleccion" con filtros basicos.

- **Pros:** Rapido de implementar. Cubre el caso mas urgente.
- **Contras:** Sin tracking, sin templates, sin programacion.
- **Esfuerzo:** Medio (1-2 semanas)
- **Impacto:** Medio

## Diseno tecnico

### Cambios en base de datos

```sql
-- Campanas de marketing
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, completed, cancelled
  campaign_type TEXT NOT NULL, -- announcement, reminder, recontact, notification, promotion

  -- Segmentacion
  audience_filters JSONB, -- filtros para seleccionar personas
  audience_count INTEGER, -- personas que matchean los filtros al momento de crear

  -- Contenido
  message_template TEXT, -- texto con variables: {nombre}, {curso}, etc.
  wa_template_name TEXT, -- nombre del template de WA si aplica
  wa_template_params JSONB, -- parametros del template

  -- Canal y envio
  channel_strategy TEXT DEFAULT 'best_available', -- best_available, specific_channel, multi_channel
  preferred_channel_id INTEGER REFERENCES channels(id),

  -- Programacion
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Resultados
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT, -- operador que creo la campana
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Destinatarios individuales de una campana
CREATE TABLE campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),

  -- Canal elegido para esta persona
  channel_id INTEGER REFERENCES channels(id),
  send_method TEXT, -- 'template', 'direct', 'email', 'skipped'
  skip_reason TEXT, -- 'no_channel', 'outside_window', 'opted_out', 'ai_disabled'

  -- Estado de envio
  status TEXT DEFAULT 'pending', -- pending, sending, sent, delivered, failed, replied
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,

  -- Tracking
  interaction_id INTEGER REFERENCES interactions(id), -- vinculo al mensaje enviado

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para performance
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

-- Templates de WhatsApp registrados
CREATE TABLE wa_templates (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  template_name TEXT NOT NULL, -- nombre registrado en Meta
  template_language TEXT DEFAULT 'es', -- idioma
  template_body TEXT, -- cuerpo del template con {{1}}, {{2}}, etc.
  template_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  param_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Logica de seleccion de canal por persona

```sql
CREATE OR REPLACE FUNCTION get_best_channel_for_person(
  p_person_id INTEGER,
  p_campaign_type TEXT
)
RETURNS TABLE(channel_id INTEGER, send_method TEXT, reason TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_last_incoming TIMESTAMPTZ;
  v_channel_record RECORD;
BEGIN
  -- Prioridad: canal con ventana abierta > email > template WA
  FOR v_channel_record IN
    SELECT
      sc.channel_id,
      ch.name AS channel_name,
      cp.provider AS provider_name,
      MAX(i.time_stamp) AS last_msg
    FROM person_conversation pc
    JOIN conversations c ON c.id = pc.conversation_id
    JOIN system_conversation sc ON sc.conversation_id = c.id
    JOIN channels ch ON ch.id = sc.channel_id
    JOIN channel_providers cp ON cp.id = ch.channel_provider_id
    LEFT JOIN interactions i ON i.id_person_conversation = pc.id
    WHERE pc.person_id = p_person_id
    GROUP BY sc.channel_id, ch.name, cp.provider
    ORDER BY MAX(i.time_stamp) DESC NULLS LAST
  LOOP
    -- Verificar si estamos dentro de ventana de 24hs
    IF v_channel_record.last_msg > NOW() - INTERVAL '24 hours' THEN
      RETURN QUERY SELECT
        v_channel_record.channel_id,
        'direct'::TEXT,
        ('Dentro de ventana 24h en ' || v_channel_record.channel_name)::TEXT;
      RETURN;
    END IF;

    -- Si es email, no tiene ventana
    IF v_channel_record.provider_name = 'email' THEN
      RETURN QUERY SELECT
        v_channel_record.channel_id,
        'email'::TEXT,
        'Email sin restriccion de ventana'::TEXT;
      RETURN;
    END IF;

    -- Si es WhatsApp y tiene template, usar template
    IF v_channel_record.provider_name IN ('whatsapp', 'whatsapp cloud api') THEN
      RETURN QUERY SELECT
        v_channel_record.channel_id,
        'template'::TEXT,
        ('Template WA fuera de ventana en ' || v_channel_record.channel_name)::TEXT;
      RETURN;
    END IF;
  END LOOP;

  -- Sin canal disponible
  RETURN QUERY SELECT
    NULL::INTEGER,
    'skipped'::TEXT,
    'Sin canal disponible para esta persona'::TEXT;
  RETURN;
END;
$$;
```

### Cambios en Make.com

**Nuevo escenario: "Campaign Dispatcher"**

1. **Trigger:** Webhook cuando campana cambia a status `sending`
2. **Leer destinatarios** con status `pending` (en batches de 50)
3. **Router por send_method:**
   - `direct` → Enviar mensaje de texto libre por el canal correspondiente
   - `template` → Enviar Message Template de WhatsApp con parametros
   - `email` → Enviar email con contenido de la campana
   - `skipped` → Marcar como skipped con motivo
4. **Actualizar status** de cada recipient a `sent` o `failed`
5. **Rate limiting:** Respetar limites de cada canal (WA: ~80 msgs/seg, email: segun proveedor)
6. **Al terminar todos:** Actualizar campana a `completed` con totales

**Nuevo escenario: "Campaign Reply Tracker"**

1. En el flujo de entrada existente, verificar si el mensaje entrante es respuesta a una campana.
2. Si hay un `campaign_recipient` con status `sent` para esa persona en las ultimas 48hs → marcar como `replied`.
3. Actualizar contador `total_replied` en la campana.

### Cambios en Edge Functions

```typescript
// Nuevos endpoints en crm-api
if (endpoint === "campaigns_list") {
  // Lista paginada de campanas con stats
}

if (endpoint === "campaign_create") {
  // Crear campana: nombre, tipo, filtros de audiencia, contenido
  // Calcular audience_count con los filtros
}

if (endpoint === "campaign_preview") {
  // Preview: cuantas personas matchean, por que canal se les enviaria, ejemplos de mensaje
}

if (endpoint === "campaign_send") {
  // Generar campaign_recipients con get_best_channel_for_person()
  // Cambiar status a 'sending'
  // Trigger webhook a Make.com
}

if (endpoint === "campaign_stats") {
  // Stats detalladas: enviados, entregados, respondidos, fallidos por canal
}

if (endpoint === "wa_templates_list") {
  // Lista de templates WA disponibles por canal
}
```

### Cambios en frontend

**Nueva pagina: `Campaigns.jsx`**

```
Estructura de la pagina:
┌─────────────────────────────────────────┐
│ Campanas de Marketing            [Nueva]│
├─────────────────────────────────────────┤
│ ┌─────┬────────────┬──────┬────────────┐│
│ │ Est │ Nombre     │ Tipo │ Resultados ││
│ ├─────┼────────────┼──────┼────────────┤│
│ │ ✅  │ Curso Node │ Anun │ 850/1200   ││
│ │ 📤  │ Seguimien  │ Reco │ 120/340    ││
│ │ 📋  │ Promo ver  │ Prom │ (draft)    ││
│ └─────┴────────────┴──────┴────────────┘│
│                                         │
│ [Detalle de campana seleccionada]       │
│ ┌── Audiencia ──┐ ┌── Resultados ──┐   │
│ │ Filtros:      │ │ Enviados: 850  │   │
│ │ interes=node  │ │ Entregados:820 │   │
│ │ sede=salta    │ │ Respondieron:45│   │
│ │ Personas: 1200│ │ Fallidos: 30   │   │
│ └───────────────┘ └────────────────┘   │
└─────────────────────────────────────────┘
```

**Wizard de creacion:**
1. Nombre y tipo de campana
2. Segmentacion (usando los mismos filtros de People.jsx: interes, sede, canal, etc.)
3. Contenido del mensaje (editor con variables {nombre}, {curso})
4. Preview (cuantos, por que canal, ejemplo de mensaje)
5. Programar o enviar ahora

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | Crear tablas `campaigns`, `campaign_recipients`, `wa_templates` | Supabase DB | 2 horas |
| 2 | Funcion `get_best_channel_for_person()` | Supabase DB | 2 horas |
| 3 | Endpoints CRUD de campanas en crm-api | Edge Functions | 1 dia |
| 4 | Pagina Campaigns.jsx (lista + detalle) | Frontend | 2 dias |
| 5 | Wizard de creacion con filtros de audiencia | Frontend | 2 dias |
| 6 | Escenario "Campaign Dispatcher" en Make.com | Make.com | 2-3 dias |
| 7 | Integracion con WhatsApp Templates API | Make.com | 1-2 dias |
| 8 | Escenario "Campaign Reply Tracker" | Make.com | 1 dia |
| 9 | Registrar templates WA existentes en la tabla | Datos | 2 horas |
| 10 | Testing end-to-end con campana de prueba | Todos | 1-2 dias |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Bloqueo de cuenta WhatsApp por envio masivo | Critico | Rate limiting estricto. Empezar con batches pequenos. Respetar limites de Meta. |
| Templates de WhatsApp rechazados por Meta | Alto | Preparar templates genericos con anticipacion. Tener aprobados antes de necesitarlos. |
| Envio a personas que pidieron no recibir mensajes | Alto | Flag `ai_enabled` de RFC-003. Campo `opted_out` en persona. Siempre verificar antes de enviar. |
| Spam a leads inactivos | Medio | Limitar recontacto a leads con actividad en ultimos 90 dias. |
| Costos de envio por WhatsApp | Medio | WA cobra por conversacion (Business vs User initiated). Calcular costo estimado antes de enviar. |
| Messenger no permite broadcast | Bajo | Documentar limitacion. Solo recontacto dentro de ventana o con message tags. |

## Criterios de aceptacion

- [ ] Crear campana con segmentacion basada en datos enriquecidos
- [ ] Preview muestra: cantidad de personas, canal de envio por persona, ejemplo de mensaje
- [ ] Envio funcional por WhatsApp (dentro y fuera de ventana con template)
- [ ] Envio funcional por email
- [ ] Tracking de entregas y respuestas
- [ ] Rate limiting por canal
- [ ] Respeto de opt-outs y flags de IA desactivada

## Dependencias

- **Requiere:** RFC-003 (control de generacion) para flag de opt-out
- **Ideal:** FEAT-009 (personas enriquecidas) ya implementado — los filtros ya existen
- **Ideal:** WhatsApp Templates pre-aprobados en Meta
- **Bloquea:** Nada directamente

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### 2026-02-20 - gviollaz

El caso mas urgente es poder avisar a los leads sobre nuevos cursos. Hoy se hace manualmente y se pierden muchos interesados. La segmentacion por interes (dato enriquecido) seria clave: si un lead pregunto por "programacion", avisarle cuando abra un curso de Node.js.

Tener en cuenta que los templates de WhatsApp hay que registrarlos y aprobarlos antes en Meta, eso lleva unos dias. Habria que empezar a registrar templates basicos.

Para email necesitamos un proveedor de envio masivo (Resend, SendGrid, etc.) o usar el que ya tenemos en Make.com.

### 2026-02-20 - Claude Opus 4.6 (Claude Code)

Coincido en empezar por los casos mas simples:

1. **V1 (rapida):** Envio por WhatsApp dentro de ventana de 24hs a personas con actividad reciente. No requiere templates.
2. **V2:** Agregar templates de WhatsApp para personas fuera de ventana.
3. **V3:** Agregar email como canal de envio masivo.
4. **V4:** Tracking de respuestas y metricas de campana.

Sobre templates de WhatsApp: recomiendo crear al menos 3 templates basicos:
- "Nuevo curso disponible" (con parametros: nombre_curso, fecha_inicio)
- "Recordatorio de inscripcion" (con parametros: nombre_curso, fecha_limite)
- "Seguimiento general" (con parametro: nombre_persona)

Pregunta: Los envios deberian crear interacciones en la DB (para que aparezcan en el historial del chat)?
Recomendacion: Si, para mantener trazabilidad completa. Cada envio de campana crea una `interaction` saliente vinculada al `campaign_recipient`.

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-02-20 | Claude Opus 4.6 | Creacion del RFC |
| 2026-02-20 | gviollaz | Contexto de negocio, restricciones de canales |
