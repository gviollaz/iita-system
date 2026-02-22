# Propuesta #9 — Difusión Masiva de Mensajes (Broadcast)

- **Fecha:** 2026-02-22
- **Autor:** Gustavo + Claude
- **Estado:** Propuesta
- **Prioridad:** P1

---

## Contexto

El sistema legacy (Chatbot IITA 2.0) tenía una funcionalidad de "Difusión" que permitía enviar plantillas de WhatsApp masivamente a contactos filtrados por etiquetas. Ver `src/core/longProcess.py` y `src/core/views.py` en `IITA-Proyectos/chatbot`.

El sistema actual (iita-system) no tiene esta funcionalidad. Se necesita reimplementarla adaptada a:
- La arquitectura actual (React + Supabase + Make.com + Edge Functions)
- Las políticas actuales de Meta (post julio 2025)
- El modelo de datos actual (`persons`, `person_soft_data`, `person_contacts`)

---

## Análisis: Qué permite Meta por canal (febrero 2026)

### WhatsApp — ✅ Difusión masiva permitida

- **Mecanismo:** Plantillas (templates) aprobadas por Meta, enviadas vía Cloud API.
- **Pricing (desde julio 2025):** Cobro por mensaje de template entregado. Ya no por ventana de 24h.
  - Marketing templates: cobro por entrega
  - Utility templates: gratis dentro de ventana de servicio
  - Authentication templates: cobro reducido
- **Template Pacing:** Meta testea plantillas nuevas en ~1,000 destinatarios primero. Solo si la calidad es buena (pocos bloqueos, buen engagement) se amplía al resto. Plantillas sin historial pueden demorar horas.
- **Quality Rating:** Determina velocidad y volumen máximo de envío. Mensajes bloqueados por usuarios bajan el rating.
- **MM Lite API (Marketing Messages Lite):** Nuevo desde abril 2025. Usa la IA de Meta Ads para optimizar entrega. Hasta 9% más delivery rate según tests de Meta. Corre en paralelo a Cloud API.
- **Límites por tier:**
  - Tier 1: 1,000 conversaciones/día
  - Tier 2: 10,000/día
  - Tier 3: 100,000/día
  - Tier 4: ilimitado

### Instagram — ❌ NO permite difusión masiva

- **Ventana de mensajes:** Solo se puede responder dentro de 24h del último mensaje del usuario.
- **Tag HUMAN_AGENT:** Extiende a 7 días, pero está **prohibido para contenido promocional**.
- **Sin sistema de plantillas:** Instagram no tiene equivalente a WhatsApp templates.
- **Consecuencia de violar:** Restricción o bloqueo de la cuenta de Instagram.
- **Alternativa:** Dentro de una ventana activa, se puede enviar un mensaje individual (no masivo).

### Messenger — ⚠️ Parcialmente disponible, en transición

- **Cambio del 10 de febrero 2026:** La API vieja de "recurring notifications" fue reemplazada por la nueva Marketing Messages API.
- **Requisitos:**
  - Opt-in explícito del usuario (deben suscribirse activamente).
  - Cooldown: un envío cada 48h por suscriptor (antes era 24h).
- **Disponibilidad geográfica:** Solo 21 países. Argentina NO está en la lista inicial.
- **Estado:** No viable para IITA en este momento. Monitorear si Meta agrega Argentina.

### Conclusión de canales

| Canal | Difusión masiva | Mecanismo | Estado para IITA |
|-------|----------------|-----------|------------------|
| WhatsApp | ✅ Sí | Templates aprobados via Cloud API | **Implementar** |
| Instagram | ❌ No | Solo respuestas en ventana 24h | No implementar |
| Messenger | ⚠️ Parcial | Marketing Messages API (opt-in, 48h cooldown) | No disponible en Argentina |

**La difusión masiva se implementa SOLO para WhatsApp.** Para Instagram y Messenger, se puede contemplar un envío individual (uno a uno) dentro de ventanas activas como feature secundario.

---

## Análisis del sistema legacy

### Código fuente: `longProcess.py`

```python
def send_massive_templates_task(message, ENDPOINT_URL, user_id, 
    company_com_channel, text, newTagName=None, templateName=None):
    
    # Crear tag de campaña si se solicitó
    if newTagName:
        newTag = Interests.objects.create(
            name=newTagName,
            description=f"Difusión por {company_com_channel.name}, plantilla: {templateName}"
        )
    
    for msg in message:
        # Enviar template via adaptador Flask
        response = requests.post(ENDPOINT_URL, json=msg[0])
        
        if response.status_code == 200:
            # Crear/obtener conversación
            conversation = Conversations.objects.get_or_create(
                company_com_channel=company_com_channel,
                person_com_channel=msg[1]
            )
            # Registrar interacción
            Interactions.create(
                text=text, status=SENT, sender='respondent',
                conversation=conversation,
                provider_message_id=data["message_id"]["messages"][0]["id"]
            )
            # Asignar tag de campaña
            if newTagName:
                PersonByInterest.objects.create(person=msg[1].person, interest=newTag)
```

### Qué hacía bien
- Creaba tag de campaña para tracking
- Registraba cada envío como Interaction
- Obtenía el `provider_message_id` para trackear status

### Qué le faltaba
- Sin rate limiting (enviaba todo lo más rápido posible)
- Sin manejo de errores robusto (el try/except estaba comentado)
- Sin tracking de progreso (no se sabía cuántos iban enviados)
- Sin límite de lote (podía intentar enviar 10,000 de golpe)
- Solo WhatsApp (no multicanal)

---

## Propuesta de implementación

### Arquitectura: Edge Function + Tabla de cola + Make.com

El flujo propuesto tiene 3 capas:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  CRM (React)    │────▶│ Edge Function │────▶│  Supabase   │────▶│ Make.com │────▶ Meta API
│  UI de difusión │     │ broadcast-   │     │  broadcast_ │     │ Escenario│
│                 │     │ prepare      │     │  queue      │     │ de envío │
└─────────────────┘     └──────────────┘     └─────────────┘     └──────────┘
         ▲                                          │
         └──────────── polling de progreso ─────────┘
```

1. **CRM (React):** El operador selecciona plantilla, filtra destinatarios, confirma y lanza.
2. **Edge Function `broadcast-prepare`:** Valida, consulta destinatarios, inserta en tabla de cola.
3. **Tabla `broadcast_queue`:** Cola persistente con estado por mensaje.
4. **Make.com escenario "Difusión":** Procesa la cola en lotes, llama a Meta Cloud API, actualiza estados.
5. **CRM:** Muestra progreso en tiempo real consultando la cola.

### ¿Por qué no Edge Function directo a Meta API?

Sería más rápido, pero:
- Las Edge Functions tienen timeout de 60s. Para 1,000+ mensajes no alcanza.
- Make.com ya tiene la conexión a Meta configurada (tokens, webhook de status).
- Make.com maneja rate limiting naturalmente (iteradores con delay).
- Los status de entrega (sent/delivered/read/failed) ya llegan por los webhooks existentes.

### ¿Por qué no clonar el backend Django?

El sistema actual no tiene servidor backend propio. Agregar Django/Flask:
- Introduce un nuevo componente para mantener y deployar.
- Duplica la lógica de conexión a Meta que ya está en Make.com.
- Va contra la arquitectura serverless adoptada.

---

## Modelo de datos

### Tabla: `broadcast_campaigns`

Registra cada campaña de difusión.

```sql
CREATE TABLE broadcast_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Inicio Robótica Marzo 2026"
  template_name TEXT NOT NULL,           -- nombre del template en Meta
  template_language TEXT DEFAULT 'es_AR',
  template_params JSONB DEFAULT '{}',    -- parámetros variables del template
  channel_provider_id INTEGER NOT NULL,  -- FK a channel_providers (1=WhatsApp)
  
  -- Filtros aplicados (para auditoría)
  filter_tags TEXT[],                    -- tags incluidos
  filter_exclude_tags TEXT[],            -- tags excluidos  
  filter_location TEXT,                  -- 'salta', 'other', 'all'
  
  -- Estado
  status TEXT DEFAULT 'draft',           -- draft, preparing, ready, sending, completed, cancelled
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Tag de campaña (opcional)
  campaign_tag TEXT,                     -- ej: "Difusion_2026-03-01_Robotica"
  
  -- Auditoría
  created_by TEXT,                       -- usuario que la creó
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### Tabla: `broadcast_queue`

Cola de mensajes individuales por campaña.

```sql
CREATE TABLE broadcast_queue (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES broadcast_campaigns(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  phone_number TEXT NOT NULL,            -- número de WhatsApp destino
  person_name TEXT,                      -- para personalización del template
  
  -- Estado del envío
  status TEXT DEFAULT 'pending',         -- pending, sending, sent, delivered, read, failed
  error_message TEXT,                    -- si falló, por qué
  provider_message_id TEXT,              -- wamid de Meta para tracking
  
  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  UNIQUE(campaign_id, person_id)         -- sin duplicados por campaña
);

-- Índice para que Make.com consulte eficientemente
CREATE INDEX idx_broadcast_queue_pending 
  ON broadcast_queue(campaign_id, status) 
  WHERE status = 'pending';
```

### Tabla: `broadcast_templates_cache`

Cache local de plantillas aprobadas en Meta (para mostrar en la UI sin llamar a Meta cada vez).

```sql
CREATE TABLE broadcast_templates_cache (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT,                         -- MARKETING, UTILITY, AUTHENTICATION
  status TEXT,                           -- APPROVED, PENDING, REJECTED
  components JSONB,                      -- header, body, footer, buttons
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_name, language)
);
```

---

## Edge Function: `broadcast-prepare`

Prepara la campaña: valida filtros, consulta destinatarios, popula la cola.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { action, ...params } = await req.json();

  switch (action) {
    case "prepare": {
      const { campaign_name, template_name, template_language, template_params,
              filter_tags, filter_exclude_tags, filter_location, campaign_tag } = params;

      // 1. Crear campaña
      const { data: campaign } = await supabase
        .from("broadcast_campaigns")
        .insert({
          name: campaign_name,
          template_name, template_language, template_params,
          channel_provider_id: 1, // WhatsApp
          filter_tags, filter_exclude_tags, filter_location,
          campaign_tag,
          status: "preparing"
        })
        .select().single();

      // 2. Consultar destinatarios
      const { data: recipients } = await supabase.rpc("get_broadcast_recipients", {
        p_include_tags: filter_tags,
        p_exclude_tags: filter_exclude_tags || [],
        p_location_filter: filter_location || "all"
      });

      // 3. Insertar en cola
      const queueItems = recipients.map(r => ({
        campaign_id: campaign.id,
        person_id: r.person_id,
        phone_number: r.phone_number,
        person_name: r.person_name
      }));

      await supabase.from("broadcast_queue").insert(queueItems);

      // 4. Actualizar totales
      await supabase.from("broadcast_campaigns")
        .update({ total_recipients: recipients.length, status: "ready" })
        .eq("id", campaign.id);

      // 5. Crear tag de campaña si se solicitó
      if (campaign_tag) {
        await supabase.from("person_soft_data").insert(
          recipients.map(r => ({
            person_id: r.person_id,
            data_name: "tag_campana_difusion",
            data_content: campaign_tag,
            source: "broadcast"
          }))
        );
      }

      return Response.json({ campaign_id: campaign.id, total: recipients.length });
    }

    case "start": {
      // Cambiar estado a "sending" — Make.com escucha este cambio
      const { campaign_id } = params;
      await supabase.from("broadcast_campaigns")
        .update({ status: "sending", started_at: new Date().toISOString() })
        .eq("id", campaign_id);
      return Response.json({ ok: true });
    }

    case "progress": {
      const { campaign_id } = params;
      const { data } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();
      return Response.json(data);
    }

    case "sync-templates": {
      // Este endpoint será llamado por Make.com que tiene el token de Meta
      const { templates } = params;
      for (const t of templates) {
        await supabase.from("broadcast_templates_cache").upsert({
          template_name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components,
          last_synced_at: new Date().toISOString()
        }, { onConflict: "template_name,language" });
      }
      return Response.json({ synced: templates.length });
    }

    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
});
```

### RPC: `get_broadcast_recipients`

```sql
CREATE OR REPLACE FUNCTION get_broadcast_recipients(
  p_include_tags TEXT[],
  p_exclude_tags TEXT[] DEFAULT '{}',
  p_location_filter TEXT DEFAULT 'all'
)
RETURNS TABLE (
  person_id INTEGER,
  phone_number TEXT,
  person_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS person_id,
    pc.contact_value AS phone_number,
    COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), 
             pc.contact_value) AS person_name
  FROM persons p
  JOIN person_contacts pc ON pc.person_id = p.id 
    AND pc.channel_provider_id IN (1, 4)  -- WhatsApp providers
    AND pc.contact_value IS NOT NULL
    AND pc.contact_value != ''
  JOIN person_soft_data psd ON psd.person_id = p.id
    AND psd.data_name = 'tag_curso_interes'
    AND psd.disabled IS NOT TRUE
    AND psd.data_content = ANY(p_include_tags)
  WHERE
    -- Filtro de ubicación
    (p_location_filter = 'all'
     OR (p_location_filter = 'salta' AND pc.contact_value LIKE '549387%')
     OR (p_location_filter = 'other' AND pc.contact_value NOT LIKE '549387%'))
    -- Excluir tags
    AND NOT EXISTS (
      SELECT 1 FROM person_soft_data psd_ex
      WHERE psd_ex.person_id = p.id
        AND psd_ex.data_name = 'tag_curso_interes'
        AND psd_ex.disabled IS NOT TRUE
        AND psd_ex.data_content = ANY(p_exclude_tags)
    )
    -- Excluir personas que ya recibieron esta campaña (si se re-ejecuta)
  ORDER BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## Escenario Make.com: "Difusión WhatsApp"

Nuevo escenario con estos pasos:

### Trigger: Polling de campañas activas

```
[Supabase: Search Rows]
  Tabla: broadcast_campaigns
  Filtro: status = 'sending'
  Límite: 1
```

### Procesamiento por lotes

```
[Supabase: Search Rows]
  Tabla: broadcast_queue  
  Filtro: campaign_id = {{campaign.id}} AND status = 'pending'
  Límite: 50  (lote de 50)
  Orden: id ASC

[Iterator] → para cada mensaje en el lote:

  [WhatsApp Cloud API: Send Template Message]
    Phone: {{item.phone_number}}
    Template: {{campaign.template_name}}
    Language: {{campaign.template_language}}
    Parameters: {{campaign.template_params}}
  
  [Router]
    ├─ Si éxito:
    │   [Supabase: Update Row]
    │     broadcast_queue.id = {{item.id}}
    │     status = 'sent'
    │     provider_message_id = {{wa_response.messages[0].id}}
    │     sent_at = NOW()
    │
    │   [Supabase: Update Row]  // Actualizar contador
    │     broadcast_campaigns.id = {{campaign.id}}
    │     sent_count = sent_count + 1
    │
    └─ Si error:
        [Supabase: Update Row]
          broadcast_queue.id = {{item.id}}
          status = 'failed'
          error_message = {{error.message}}
        
        [Supabase: Update Row]
          broadcast_campaigns.id = {{campaign.id}}
          failed_count = failed_count + 1

  [Sleep: 100ms]  // Rate limiting

[Supabase: Search Rows]  // ¿Quedan pendientes?
  Filtro: campaign_id = {{campaign.id}} AND status = 'pending'
  Límite: 1

[Router]
  ├─ Si hay más → Loop (volver al lote)
  └─ Si no hay más:
      [Supabase: Update Row]
        broadcast_campaigns.id = {{campaign.id}}
        status = 'completed'
        completed_at = NOW()
```

### Sincronización de status de entrega

Los webhooks de Meta ya llegan a Make.com (Etapa 1 - Entrada). Agregar un paso:

```
[En el escenario de entrada existente, después de procesar status]

[Router: ¿Es un mensaje de broadcast?]
  Condición: EXISTS en broadcast_queue WHERE provider_message_id = {{status.message_id}}
  
  [Supabase: Update Row]
    broadcast_queue: status = {{nuevo_status}}, delivered_at/read_at = NOW()
  
  [Supabase: Update Row]  // Incrementar contadores
    broadcast_campaigns: delivered_count + 1 (o read_count + 1)
```

---

## Interfaz CRM (React)

### Pantalla principal: Lista de campañas

```
┌─────────────────────────────────────────────────────────────┐
│ 📢 Difusión Masiva                              [+ Nueva]  │
├─────────────────────────────────────────────────────────────┤
│ Nombre              │ Template    │ Estado    │ Progreso    │
│─────────────────────│─────────────│───────────│─────────────│
│ Inicio Robótica Mar │ inicio_curs │ Enviando  │ 234/750 ██▓ │
│ Promo Python Feb    │ promo_pyth  │ Completa  │ 523/523 ███ │
│ Becas 2026          │ becas_info  │ Borrador  │ 0/1,200     │
└─────────────────────────────────────────────────────────────┘
```

### Pantalla: Crear campaña

1. **Seleccionar plantilla:** Dropdown con templates de `broadcast_templates_cache` (filtro: status=APPROVED, category=MARKETING).
2. **Vista previa:** Renderizar el template con sus componentes (header, body, footer, botones).
3. **Completar parámetros:** Si el template tiene variables `{{1}}`, `{{2}}`, mostrar campos editables.
4. **Filtrar destinatarios:**
   - Checkboxes con tags de `tag_curso_interes` + cantidad de personas
   - Tags a excluir (ej: excluir quienes ya recibieron campaña anterior)
   - Filtro de ubicación (Salta / Interior / Todos)
5. **Vista previa de destinatarios:** Tabla con nombre, teléfono, tags.
6. **Tag de campaña (opcional):** Checkbox + nombre del tag.
7. **Confirmar y preparar:** Llama a `broadcast-prepare` action=prepare.
8. **Enviar:** Llama a `broadcast-prepare` action=start.

### Pantalla: Progreso de campaña

Polling cada 5s a `broadcast-prepare` action=progress:

```
┌─────────────────────────────────────────────────────────┐
│ 📢 Inicio Robótica Educativa - Marzo 2026               │
│ Template: inicio_curso_robotica (es_AR)                  │
│                                                          │
│ Progreso: ██████████████░░░░░░ 72%                       │
│                                                          │
│ Enviados:    540 / 750                                   │
│ Entregados:  489                                         │
│ Leídos:      312                                         │
│ Fallidos:    8                                           │
│                                                          │
│ [Pausar]  [Cancelar]                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Comparación: Legacy vs Propuesta

| Aspecto | Legacy (longProcess.py) | Propuesta |
|---------|------------------------|-----------|
| Canal | Solo WhatsApp | WhatsApp (extensible) |
| Backend | Django thread | Edge Function + Make.com |
| Cola | No (enviaba directo) | Tabla `broadcast_queue` |
| Rate limiting | No | Sleep 100ms en Make.com |
| Progreso | No visible | Tiempo real en CRM |
| Tracking | Interacción individual | Campaña + cola + contadores |
| Reintentos | No | Posible (re-procesar failed) |
| Tag campaña | Sí | Sí |
| Status delivery | No (solo sent) | sent/delivered/read/failed |
| Rollback | No | Cancelar pendientes |

---

## Plan de implementación

### Fase 1: Infraestructura (1-2 días)
- [ ] Crear tablas `broadcast_campaigns`, `broadcast_queue`, `broadcast_templates_cache`
- [ ] Crear RPC `get_broadcast_recipients`
- [ ] Deploy Edge Function `broadcast-prepare`

### Fase 2: Make.com (1 día)
- [ ] Crear escenario "Difusión WhatsApp"
- [ ] Crear escenario "Sync Templates" (consulta templates aprobados de Meta y los guarda en cache)
- [ ] Agregar hook de status de broadcast al escenario de entrada existente

### Fase 3: Frontend (2-3 días)
- [ ] Pantalla de lista de campañas
- [ ] Pantalla de creación (selección template + filtros + preview)
- [ ] Pantalla de progreso con polling

### Fase 4: Testing y ajustes (1 día)
- [ ] Test con template de prueba y lote pequeño (10 contactos)
- [ ] Verificar tracking de status (delivered/read)
- [ ] Verificar tag de campaña

**Estimación total: 5-7 días**

---

## Requisitos previos

1. **Templates aprobados en Meta:** Se necesita al menos un template de marketing aprobado en la cuenta de WhatsApp Business. Se crean desde Meta Business Manager > WhatsApp > Message Templates.

2. **Tier de mensajería:** Verificar el tier actual de la cuenta WABA de IITA para saber el límite diario.

3. **Token de Meta en Make.com:** Ya debería estar configurado si los escenarios actuales de WhatsApp funcionan.

4. **RLS en tablas nuevas:** Definir políticas de acceso. Como mínimo, solo usuarios autenticados deberían poder crear/ver campañas (requiere PROPUESTA-4 JWT).

---

## Consideraciones de privacidad y compliance

- Los mensajes de marketing de WhatsApp requieren que el contacto haya interactuado previamente con el número de IITA (no es cold outreach a números aleatorios).
- Si el contacto bloquea, Meta reduce el Quality Rating. Campañas con alto % de bloqueo pueden resultar en restricción del número.
- Documentar cada campaña (quién la creó, qué filtros usó, cuántos recibieron) para auditoría.
- Considerar un opt-out: si un contacto responde "no quiero recibir más", marcar en person_soft_data y excluirlo de futuras campañas.

---

## Feature futuro: Envío individual en ventana activa (Instagram/Messenger)

Como extensión futura, se podría agregar la posibilidad de enviar un mensaje individual (no template) a contactos que tienen una conversación activa (dentro de la ventana de 24h). Esto permitiría:

- Desde la vista de un contacto individual, enviar un mensaje rápido por el canal activo.
- No sería "masivo" sino manual, uno por uno.
- Requiere verificar que la ventana esté abierta (último mensaje incoming < 24h).

Esto NO es parte de esta propuesta sino una extensión posterior.
