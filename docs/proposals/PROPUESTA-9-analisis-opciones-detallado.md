# Propuesta #9 — Análisis Detallado de Opciones de Implementación

## Difusión Masiva de Mensajes WhatsApp

- **Fecha:** 2026-02-22
- **Autor:** Gustavo + Claude
- **Estado:** Análisis en profundidad
- **Documento complementario de:** [PROPUESTA-9-difusion-masiva-whatsapp.md](PROPUESTA-9-difusion-masiva-whatsapp.md)

---

## 1. Resumen ejecutivo

Este documento analiza en profundidad tres opciones de implementación para el módulo de difusión masiva de WhatsApp, incluyendo el modelo de datos completo para gestión de plantillas (templates) de Meta, el ciclo de vida de aprobación/pre-aprobación, y las implicancias operativas y económicas de cada opción.

Las opciones son:

| Opción | Resumen | Recomendación |
|--------|---------|---------------|
| **A** — Make.com puro | Make.com orquesta todo: consulta destinatarios, envía templates, registra resultados | No recomendada sola |
| **B** — Edge Function pura | Edge Function llama directo a Meta Graph API sin intermediario | No recomendada sola |
| **A+B** — Híbrida | Edge Function prepara + tabla de cola + Make.com envía | **Recomendada** |

---

## 2. Contexto técnico: API de Meta para templates

### 2.1 Endpoints relevantes (Graph API v21.0, febrero 2026)

**Gestión de templates:**
```
GET  /{waba-id}/message_templates          → Listar templates
POST /{waba-id}/message_templates          → Crear/enviar template para aprobación
DELETE /{waba-id}/message_templates         → Eliminar template
```

**Envío de mensajes:**
```
POST /{phone-number-id}/messages           → Enviar mensaje (template o libre)
```

**Payload para enviar un template:**
```json
{
  "messaging_product": "whatsapp",
  "to": "5493874512345",
  "type": "template",
  "template": {
    "name": "inicio_curso_robotica",
    "language": { "code": "es_AR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          { "type": "image", "image": { "link": "https://..." } }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "María" },
          { "type": "text", "text": "Robótica Educativa" },
          { "type": "text", "text": "lunes 3 de marzo" }
        ]
      }
    ]
  }
}
```

### 2.2 Categorías de templates y pricing (post julio 2025)

| Categoría | Uso | Costo (Sudamérica) | Ventana gratuita |
|-----------|-----|---------------------|------------------|
| **Marketing** | Promociones, anuncios de cursos, ofertas | ~USD 0.047/msg | No |
| **Utility** | Confirmaciones, recordatorios, actualizaciones | ~USD 0.019/msg | Gratis dentro de 24h de servicio |
| **Authentication** | OTP, verificación | ~USD 0.014/msg | No |

**Implicancia para IITA:** Una campaña de 750 destinatarios con template de marketing cuesta aproximadamente USD 35. Una de 3,000 destinatarios, USD 141.

### 2.3 Ciclo de vida de un template en Meta

```
                                    ┌─────────┐
                                    │REJECTED │ → editar y reenviar (nombre nuevo)
                                    └────▲────┘
                                         │ (revisión ML negativa)
┌─────────┐    POST /templates    ┌──────┴──────┐    (revisión ML ok)    ┌──────────┐
│  DRAFT   │ ──────────────────▶ │  PENDING     │ ────────────────────▶ │ APPROVED │
│ (local)  │                     │  (IN_REVIEW) │                       │          │
└─────────┘                      └──────────────┘                       └────┬─────┘
                                                                             │
                                                          feedback negativo  │ 
                                                          de usuarios        ▼
                                                                        ┌─────────┐
                                                                        │ PAUSED  │ (3-6h)
                                                                        └────┬────┘
                                                                             │ 3er pause
                                                                             ▼
                                                                        ┌──────────┐
                                                                        │ DISABLED │
                                                                        └──────────┘
```

**Estados:**
- **PENDING / IN_REVIEW**: En revisión por Meta. Proceso ML automático, típicamente minutos a 48h.
- **APPROVED**: Listo para usar. Se puede enviar.
- **REJECTED**: Rechazado. Hay que crear uno nuevo con nombre distinto (Meta bloquea reutilización del nombre por 30 días).
- **PAUSED**: Pausado por feedback negativo (bloqueos, reportes de spam). No se puede enviar por 3-6h. Después de 3 pausas → DISABLED.
- **DISABLED**: Desactivado permanentemente. Hay que crear uno nuevo.

**Template Pacing (nuevos templates):**
Meta envía primero a un subgrupo pequeño (~1,000 destinatarios). Si las métricas de calidad son buenas (pocos bloqueos, buena tasa de apertura), Meta libera el envío al resto. Un template nuevo en su primera campaña puede tardar horas en completar el envío total. Templates con historial positivo se envían inmediatamente.

### 2.4 Quality Rating de la cuenta WABA

Meta asigna un Quality Rating al número de teléfono basado en:
- Tasa de bloqueo por usuarios
- Reportes de spam
- Tasa de entrega

El Quality Rating determina el **messaging tier** (límite diario de conversaciones nuevas):

| Tier | Conversaciones nuevas/día | Cómo subir |
|------|---------------------------|------------|
| 1 (inicial) | 250 | Verificar negocio en Meta |
| 2 | 1,000 | Mantener quality alto + volumen |
| 3 | 10,000 | Mantener quality alto + volumen |
| 4 | 100,000 | Mantener quality alto + volumen |
| Ilimitado | Sin límite | Quality consistentemente alto |

**Riesgo para IITA:** Si una campaña genera muchos bloqueos, el tier puede bajar, afectando TODA la operación de WhatsApp (no solo difusión sino también atención al cliente).

---

## 3. Análisis detallado de opciones

### 3.1 Opción A — Make.com puro

#### Arquitectura

```
┌──────────────┐     ┌─────────────────────────────────────────────────┐
│  CRM (React) │     │                Make.com                         │
│              │     │                                                  │
│ [Lanzar]  ───┼────▶│ Webhook → Supabase(query destinatarios)         │
│              │     │        → Iterator                                │
│              │     │           → WhatsApp: Send Template              │
│              │     │           → Supabase: Update status              │
│              │     │        → Supabase: Update campaign totals        │
│              │     │                                                  │
│ [Progreso]───┼────▶│ (No — el CRM consulta Supabase directo)        │
└──────────────┘     └─────────────────────────────────────────────────┘
```

El CRM llama a un webhook de Make.com con los parámetros de la campaña. Make.com consulta los destinatarios vía Supabase, itera sobre cada uno, envía el template via el módulo WhatsApp Business Cloud "Send a Template Message", y actualiza el estado en Supabase.

#### Ventajas

**V1 — Conexión a Meta ya configurada.** Make.com ya tiene la conexión a WhatsApp Business Cloud configurada con el token permanente de Meta. No hay que gestionar tokens ni secretos adicionales.

**V2 — Módulo nativo "Send a Template Message".** Make.com tiene un módulo dedicado que abstrae los detalles del payload de la Graph API. Se configura visualmente: seleccionar sender, recipient, template name, language, parámetros. Reduce posibilidad de errores en el formato del JSON.

**V3 — Rate limiting implícito.** Make.com procesa iteradores secuencialmente con un delay natural entre operaciones (~200-500ms). Para 750 mensajes, el envío tarda ~5-10 minutos. Esto es conservador pero seguro para el Quality Rating.

**V4 — Sin código backend.** No hay que escribir ni mantener código de envío. La lógica es visual y modificable sin deploy.

**V5 — Manejo de errores integrado.** Make.com tiene error handlers nativos: si un envío falla, puede loguear el error y continuar con el siguiente sin abortar toda la campaña.

**V6 — Webhooks de status ya configurados.** Los status de Meta (delivered, read, failed) ya llegan a los escenarios de entrada existentes de Make.com. Solo hay que agregar un router que identifique mensajes de broadcast y actualice la tabla de cola.

#### Desventajas

**D1 — Costo de operaciones Make.com.** Cada operación en Make.com cuenta: la query a Supabase (1 op), cada envío de WhatsApp (1 op por destinatario), cada update de status (1 op por destinatario). Para una campaña de 750 personas: ~2,250 operaciones. Con el plan actual de IITA, hay que verificar que las operaciones mensuales alcancen. Hacer campañas frecuentes (ej: semanales a 3,000 personas) puede costar entre 10,000-15,000 operaciones/mes solo de difusión.

**D2 — Lentitud para lotes grandes.** El delay natural de Make.com (~300ms por operación) significa que 3,000 mensajes tardan ~15 minutos. Para 10,000 mensajes, ~50 minutos. Es aceptable para IITA hoy pero no escala bien.

**D3 — Query de destinatarios limitada.** El módulo Supabase de Make.com tiene límite de registros por consulta (típicamente 100-500 por página). Para obtener 3,000 destinatarios hay que paginar, lo que agrega complejidad al escenario y más operaciones.

**D4 — No hay tabla de cola persistente.** Si Make.com falla a mitad de campaña (timeout, error de red, límite de operaciones alcanzado), no hay forma de retomar desde donde quedó. Hay que re-ejecutar toda la campaña y filtrar manualmente los ya enviados.

**D5 — Gestión de templates desde Make.com es limitada.** Make.com no tiene un módulo nativo para listar/crear/gestionar templates de Meta. Solo tiene "Send a Template Message". Para listar templates aprobados habría que usar un módulo HTTP genérico llamando a la Graph API manualmente.

**D6 — No hay validación previa.** Si el template está pausado o el número está en tier bajo, Make.com intentará enviar igualmente y fallará mensaje por mensaje, consumiendo operaciones innecesariamente.

#### Resumen costos Opción A

| Concepto | Campaña 750 personas | Campaña 3,000 personas |
|----------|---------------------|------------------------|
| Operaciones Make.com | ~2,250 | ~9,000 |
| Costo Meta (marketing template) | ~USD 35 | ~USD 141 |
| Tiempo de envío | ~5-10 min | ~15-25 min |
| Desarrollo | 1-2 días | 1-2 días |

---

### 3.2 Opción B — Edge Function pura

#### Arquitectura

```
┌──────────────┐     ┌────────────────────┐     ┌───────────────────┐
│  CRM (React) │     │   Edge Function    │     │  Meta Graph API   │
│              │     │  broadcast-send    │     │                   │
│ [Lanzar]  ───┼────▶│                    │     │                   │
│              │     │ 1. Query destinos  │     │                   │
│              │     │ 2. Loop:           │     │                   │
│              │     │    POST /messages ─┼────▶│ Send template msg │
│              │     │    Update DB       │     │                   │
│              │     │ 3. Return totals   │     │                   │
│              │     │                    │     │                   │
│ [Progreso]───┼────▶│ (query broadcast_  │     │                   │
│              │     │  queue directo)    │     │                   │
└──────────────┘     └────────────────────┘     └───────────────────┘
```

Una Edge Function (Deno en Supabase) recibe la solicitud del CRM, consulta destinatarios directamente en la base de datos, y llama a la Meta Graph API usando `fetch()` para enviar cada template.

#### Ventajas

**V1 — Sin costo Make.com.** Cero operaciones de Make.com consumidas. La Edge Function corre gratis en Supabase (dentro de los límites del plan).

**V2 — Velocidad máxima.** La Edge Function puede hacer requests en paralelo (Promise.all con concurrencia controlada). Meta acepta hasta 80-500 msg/seg según el tier. Para 750 mensajes con concurrencia de 10, el envío tarda ~15 segundos (vs ~10 minutos en Make.com).

**V3 — Acceso directo a la base de datos.** La Edge Function usa el Supabase client con service_role_key, sin limitaciones de paginación. Puede obtener 10,000 destinatarios en una sola query.

**V4 — Control total del payload.** Se construye el JSON exacto para la Graph API. Se pueden implementar features avanzados como: templates con header de imagen dinámico, botones con URL personalizada por destinatario, personalización del nombre en el body.

**V5 — Gestión completa de templates.** La Edge Function puede listar, crear y validar templates llamando directamente a la Graph API. Esto permite sincronizar templates aprobados, crear templates nuevos desde el CRM, y verificar el estado antes de lanzar una campaña.

**V6 — Validación previa.** Antes de iniciar el envío, la función puede verificar: que el template esté APPROVED, que el Quality Rating sea aceptable, que no se supere el tier de mensajería, y que los números sean válidos.

#### Desventajas

**D1 — Timeout de 60 segundos.** Las Edge Functions de Supabase tienen un hard limit de 60 segundos de ejecución. Para 750 mensajes con concurrencia de 10 y ~100ms por request a Meta, el envío puro tarda ~7.5 segundos. Con overhead de DB writes, ~15-20 segundos. Alcanza para 750 pero NO para 3,000+ (necesitaría ~60-80 segundos solo de envío). Soluciones: dividir en lotes de 500 y que el CRM lance varios calls, o usar Deno.cron (no disponible en Supabase Edge Functions actualmente).

**D2 — Gestión del token de Meta.** Hay que almacenar el Meta Access Token (System User token permanente) en las variables de entorno de Supabase Edge Functions o en una tabla de configuración. Actualmente ese token está solo en Make.com. Habría que generar un segundo token permanente o compartir el existente.

**D3 — No captura status de entrega.** Los webhooks de Meta (delivered/read/failed) llegan al endpoint configurado, que actualmente es un escenario de Make.com. La Edge Function no puede "escuchar" webhooks continuamente — es request/response. Hay que mantener Make.com o crear un endpoint webhook separado para capturar status.

**D4 — Complejidad de error handling.** Si la Edge Function falla a mitad de envío (timeout, error de red a Meta, error de base de datos), hay que implementar manualmente la lógica de reintentos, partial failure, y idempotencia. En Make.com esto viene gratis con error handlers y el "resume" de escenarios.

**D5 — Necesita implementar rate limiting.** Meta tiene rate limits por número de teléfono. Si se envían demasiados requests muy rápido, Meta devuelve error 429. Hay que implementar backoff exponencial y control de concurrencia, lo cual agrega complejidad al código.

**D6 — Meta Graph API v21/v22 cambia.** Meta actualiza la Graph API cada ~6 meses y depreca versiones viejas. El código de la Edge Function necesita mantenimiento periódico para actualizar la versión de la API y adaptar cambios en el formato de templates.

#### Resumen costos Opción B

| Concepto | Campaña 750 personas | Campaña 3,000 personas |
|----------|---------------------|------------------------|
| Operaciones Make.com | 0 | 0 |
| Costo Meta (marketing template) | ~USD 35 | ~USD 141 |
| Tiempo de envío | ~15-20 seg | ❌ Timeout (necesita batching) |
| Desarrollo | 3-4 días | 3-4 días |

---

### 3.3 Opción A+B — Híbrida (recomendada)

#### Arquitectura

```
┌──────────────┐     ┌────────────────────┐     ┌──────────┐     ┌────────────────┐
│  CRM (React) │     │   Edge Functions   │     │ Supabase │     │   Make.com     │
│              │     │                    │     │          │     │                │
│ [1.Preparar]─┼────▶│ broadcast-prepare  │     │          │     │                │
│              │     │  → query destinos  │────▶│ broadcast│     │                │
│              │     │  → insert en cola  │     │ _queue   │     │                │
│              │     │  → validar template│     │          │     │                │
│              │     │  → return preview  │     │          │     │                │
│              │     │                    │     │          │     │                │
│ [2.Enviar] ──┼────▶│ broadcast-start    │     │          │     │                │
│              │     │  → status=sending  │────▶│ campaign │     │                │
│              │     │                    │     │ status   │────▶│ Polling: read  │
│              │     │                    │     │ change   │     │ queue pending  │
│              │     │                    │     │          │     │ → WA: Send Tpl │
│              │     │                    │     │          │◀────│ → Update queue │
│              │     │                    │     │          │     │ → Update totals│
│ [3.Progreso]─┼────▶│ broadcast-progress │     │          │     │                │
│              │     │  → return counters │◀────│          │     │                │
│              │     │                    │     │          │     │                │
│ [Templates]──┼────▶│ broadcast-templates│     │          │     │                │
│              │     │  → GET Meta API    │     │          │     │                │
│              │     │  → sync to cache   │────▶│ templates│     │                │
│              │     │  → POST Meta API   │     │ _cache   │     │                │
│              │     │  (crear/editar)    │     │          │     │                │
└──────────────┘     └────────────────────┘     └──────────┘     └────────────────┘
```

#### Principio de diseño: cada componente hace lo que mejor sabe

| Componente | Responsabilidad | Justificación |
|------------|----------------|---------------|
| **Edge Functions** | Lógica de negocio: validar, preparar, consultar, gestionar templates | Acceso directo a DB, control total del código, sin costo por operación |
| **Supabase (tablas)** | Persistencia: cola de mensajes, estado de campaña, cache de templates | Cola persistente, resistente a fallos, consultable desde cualquier componente |
| **Make.com** | Envío: procesar cola y llamar a Meta API | Ya tiene el token de Meta, tiene rate limiting natural, maneja errores de envío |
| **CRM (React)** | UI: crear campaña, monitorear progreso | Frontend existente, solo se agregan pantallas |

#### Flujo completo paso a paso

**Paso 1 — El operador crea la campaña (CRM)**

El operador abre "Difusión" en el CRM, selecciona un template aprobado (desde `broadcast_templates_cache`), completa los parámetros variables, selecciona los filtros de destinatarios (tags, ubicación), y presiona "Preparar".

**Paso 2 — Edge Function `broadcast-prepare` (acción: prepare)**

La Edge Function:
1. Verifica que el template exista y esté APPROVED en el cache. Si el cache tiene más de 24h, resincroniza con Meta.
2. Consulta destinatarios con la RPC `get_broadcast_recipients`.
3. Inserta los destinatarios en `broadcast_queue` con status `pending`.
4. Crea el registro de campaña en `broadcast_campaigns` con status `ready`.
5. Retorna al CRM: total de destinatarios, costo estimado (total × precio por template de marketing), y preview de los primeros 10 nombres.

Tiempo de ejecución: ~2-5 segundos para 3,000 destinatarios. Bien dentro del timeout de 60s.

**Paso 3 — El operador confirma y lanza (CRM)**

El CRM muestra el resumen: "750 destinatarios, template inicio_curso_robotica, costo estimado USD 35. ¿Enviar?" El operador confirma.

**Paso 4 — Edge Function `broadcast-start` (acción: start)**

Cambia el status de la campaña a `sending` y registra `started_at`. Este cambio es lo que Make.com detecta.

**Paso 5 — Make.com procesa la cola**

Un escenario en Make.com corre cada 5 minutos (o con webhook on-demand):
1. Busca campañas con status `sending` en `broadcast_campaigns`.
2. Lee un lote de 50 mensajes con status `pending` de `broadcast_queue`.
3. Para cada mensaje: llama a WhatsApp Business Cloud → Send a Template Message.
4. Actualiza el status del mensaje en la cola (sent/failed) y los contadores de la campaña.
5. Si quedan mensajes pendientes, repite. Si no, cambia la campaña a `completed`.

**Paso 6 — El CRM muestra progreso**

El CRM hace polling cada 5 segundos a la Edge Function `broadcast-progress` que simplemente lee los contadores de `broadcast_campaigns`. Muestra barra de progreso, contadores de enviados/entregados/leídos/fallidos.

**Paso 7 — Status de entrega se actualizan**

Los webhooks de Meta (delivered/read) ya llegan a Make.com por los escenarios de entrada existentes. Se agrega un paso que verifica si el `provider_message_id` existe en `broadcast_queue` y actualiza el status.

#### Ventajas específicas del híbrido

**V1 — Cola persistente y resistente a fallos.** Si Make.com falla, se cae, o alcanza el límite de operaciones, la cola queda en Supabase con los mensajes pendientes marcados. Cuando Make.com vuelva a correr, retoma exactamente donde quedó. No hay mensajes perdidos ni duplicados (la constraint UNIQUE(campaign_id, person_id) previene reinserción).

**V2 — Preparación instantánea, envío progresivo.** La parte que necesita ser rápida (preparar y mostrar preview) se ejecuta en la Edge Function en segundos. La parte que puede ser lenta (enviar 750-3000 mensajes) se delega a Make.com que la procesa en background.

**V3 — Separación de credenciales.** El token de Meta se queda solo en Make.com. La Edge Function no necesita acceso directo a Meta para el envío — solo para gestión de templates (que puede usar un token read-only separado, o hacer la sincronización vía Make.com).

**V4 — Gestión completa de templates.** La Edge Function puede sincronizar templates desde Meta, permitiendo que el CRM muestre solo los aprobados, muestre su estructura (header, body, footer, botones), y permita previsualizar el mensaje antes de enviar.

**V5 — Costo óptimo.** Las operaciones costosas de Make.com se limitan al envío (1 operación por mensaje + 1 update por mensaje = ~1,500 ops para 750 mensajes). La preparación, progreso, y gestión de templates son gratuitos (Edge Function + Supabase queries).

**V6 — Extensible.** Agregar un nuevo canal en el futuro (ej: Messenger cuando Argentina sea elegible) solo requiere agregar un paso más en el escenario de Make.com, sin cambiar la Edge Function ni las tablas.

#### Desventajas del híbrido

**D1 — Más componentes.** Son 4 componentes involucrados (CRM, Edge Functions, Supabase, Make.com) vs 2-3 en las opciones puras. Más puntos de fallo potencial.

**D2 — Latencia de envío.** Make.com corre por polling (cada 5 min) o webhook. Desde que el operador presiona "Enviar" hasta que sale el primer mensaje pueden pasar hasta 5 minutos si es por polling. Mitigable con webhook on-demand.

**D3 — Desarrollo más largo.** Requiere trabajo en 3 capas (Edge Functions, Make.com scenario, React UI). Estimación: 5-7 días vs 2-3 días de la opción A pura.

#### Resumen costos Opción A+B

| Concepto | Campaña 750 personas | Campaña 3,000 personas |
|----------|---------------------|------------------------|
| Operaciones Make.com | ~1,500 | ~6,000 |
| Costo Meta (marketing template) | ~USD 35 | ~USD 141 |
| Tiempo de envío | ~5-10 min | ~15-20 min |
| Desarrollo | 5-7 días | 5-7 días |

---

## 4. Comparación consolidada

### 4.1 Tabla comparativa general

| Criterio | A (Make puro) | B (Edge puro) | A+B (Híbrido) |
|----------|:------------:|:-------------:|:--------------:|
| **Tiempo de desarrollo** | ★★★ (2-3 días) | ★★ (3-4 días) | ★★ (5-7 días) |
| **Costo Make.com por campaña (750)** | ~2,250 ops | 0 ops | ~1,500 ops |
| **Velocidad de envío** | Lenta (10 min) | Rápida (20s) | Media (10 min) |
| **Resistencia a fallos** | ★ (sin cola) | ★★ (con cola pero timeout) | ★★★ (cola persistente) |
| **Escalabilidad (>3,000)** | ★★ (lento pero funciona) | ★ (timeout) | ★★★ (sin límite práctico) |
| **Gestión de templates** | ★ (manual o HTTP genérico) | ★★★ (API directa) | ★★★ (API directa) |
| **Complejidad de mantenimiento** | ★★★ (bajo) | ★★ (medio) | ★★ (medio) |
| **Tracking de status (delivered/read)** | ★★★ (ya configurado) | ★ (requiere webhook nuevo) | ★★★ (ya configurado) |
| **Validación previa del template** | ★ (no) | ★★★ (sí) | ★★★ (sí) |
| **Token Meta** | Ya configurado | Requiere configurar | Parcial (envío: Make / templates: EF) |

### 4.2 Escenarios de decisión

**Si IITA va a hacer ≤2 campañas/mes con ≤500 destinatarios:**
→ Opción A es suficiente. Rápida de implementar, costo de operaciones bajo.

**Si IITA va a hacer campañas frecuentes (semanal) o con >1,000 destinatarios:**
→ Opción A+B. La cola persistente evita problemas de fallos parciales y el costo de Make.com se optimiza.

**Si IITA migra a un backend propio en el futuro (ej: servidor Node.js/Python):**
→ Opción B como base, con la cola de Supabase. El backend reemplaza tanto la Edge Function como Make.com.

---

## 5. Modelo de datos completo

### 5.1 Tabla: `broadcast_templates_cache`

Cache local de templates de Meta. Se sincroniza periódicamente desde la Graph API.

```sql
CREATE TABLE broadcast_templates_cache (
  id SERIAL PRIMARY KEY,
  
  -- Identificación en Meta
  meta_template_id TEXT,                 -- ID de Meta (ej: "123456789")
  template_name TEXT NOT NULL,           -- nombre del template (lowercase, underscores)
  language TEXT NOT NULL DEFAULT 'es_AR',
  
  -- Categoría y estado en Meta
  category TEXT NOT NULL,                -- 'MARKETING', 'UTILITY', 'AUTHENTICATION'
  status TEXT NOT NULL,                  -- 'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'
  quality_score TEXT,                    -- 'GREEN', 'YELLOW', 'RED', null
  
  -- Estructura del template (tal cual viene de Meta)
  components JSONB NOT NULL DEFAULT '[]',
  -- Ejemplo de components:
  -- [
  --   {"type": "HEADER", "format": "IMAGE", "example": {"header_handle": ["https://..."]}},
  --   {"type": "BODY", "text": "Hola {{1}}, te informamos que el curso de {{2}} comienza el {{3}}."},
  --   {"type": "FOOTER", "text": "IITA - Instituto de Innovación y Tecnología Aplicada"},
  --   {"type": "BUTTONS", "buttons": [{"type": "URL", "text": "Ver más", "url": "https://iita.com.ar/curso/{{1}}"}]}
  -- ]
  
  -- Parámetros detectados (para la UI)
  parameter_count INTEGER DEFAULT 0,     -- cantidad de {{N}} en el body
  parameter_names JSONB DEFAULT '[]',    -- nombres descriptivos asignados por el operador
  -- Ejemplo: ["nombre_destinatario", "nombre_curso", "fecha_inicio"]
  
  -- Ejemplo pre-cargado (para preview en la UI)
  sample_values JSONB DEFAULT '[]',
  -- Ejemplo: ["María", "Robótica Educativa", "lunes 3 de marzo"]
  
  -- Metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_name, language)
);

-- Índice para búsqueda rápida de templates aprobados
CREATE INDEX idx_templates_approved 
  ON broadcast_templates_cache(category, status) 
  WHERE status = 'APPROVED';
```

### 5.2 Tabla: `broadcast_campaigns`

Cada campaña de difusión.

```sql
CREATE TABLE broadcast_campaigns (
  id SERIAL PRIMARY KEY,
  
  -- Identificación
  name TEXT NOT NULL,                     -- "Inicio Robótica Educativa - Marzo 2026"
  description TEXT,                       -- descripción libre
  
  -- Template a enviar
  template_name TEXT NOT NULL,            -- FK lógica a broadcast_templates_cache
  template_language TEXT DEFAULT 'es_AR',
  template_category TEXT,                 -- 'MARKETING', 'UTILITY'
  
  -- Parámetros del template para esta campaña
  -- Pueden ser fijos (mismos para todos) o dinámicos (por destinatario)
  template_params JSONB DEFAULT '{}',
  -- Ejemplo para params fijos:
  -- {
  --   "header": [{"type": "image", "image": {"link": "https://iita.com.ar/img/robotica.jpg"}}],
  --   "body": [
  --     {"type": "text", "text": "{{person_name}}"},    -- dinámico: se reemplaza por nombre
  --     {"type": "text", "text": "Robótica Educativa"},  -- fijo
  --     {"type": "text", "text": "lunes 3 de marzo"}     -- fijo
  --   ],
  --   "buttons": [{"type": "text", "text": "robotica-educativa"}]
  -- }
  
  -- Canal de envío
  channel_provider_id INTEGER DEFAULT 1, -- 1=WhatsApp
  sender_phone_number_id TEXT,           -- Meta Phone Number ID del remitente
  
  -- Filtros aplicados (para auditoría y re-ejecución)
  filter_tags TEXT[] DEFAULT '{}',
  filter_exclude_tags TEXT[] DEFAULT '{}',
  filter_location TEXT DEFAULT 'all',    -- 'salta', 'other', 'all'
  filter_custom_sql TEXT,                -- filtro SQL adicional (avanzado)
  
  -- Estado y progreso
  status TEXT DEFAULT 'draft',
  -- Valores: draft, preparing, ready, sending, paused, completed, cancelled, failed
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Costo estimado y real
  estimated_cost_usd NUMERIC(10,2),
  -- Se calcula: total_recipients × precio_por_template_categoria_region
  
  -- Tag de campaña (para tracking posterior)
  campaign_tag TEXT,                      -- ej: "Difusion_2026-03-01_Robotica"
  create_campaign_tag BOOLEAN DEFAULT FALSE,
  
  -- Auditoría
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Notas del resultado
  result_notes TEXT                       -- observaciones post-campaña
);

-- Para el polling de Make.com
CREATE INDEX idx_campaigns_sending 
  ON broadcast_campaigns(status) 
  WHERE status = 'sending';
```

### 5.3 Tabla: `broadcast_queue`

Cola de mensajes individuales por campaña.

```sql
CREATE TABLE broadcast_queue (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id),
  
  -- Datos del destinatario (desnormalizados para que Make.com no necesite JOINs)
  phone_number TEXT NOT NULL,
  person_name TEXT,
  
  -- Parámetros personalizados para este destinatario
  -- Si el template tiene {{1}} = nombre, aquí va el nombre de ESTA persona
  personalized_params JSONB,
  
  -- Estado del envío
  status TEXT DEFAULT 'pending',
  -- Valores: pending, sending, sent, delivered, read, failed, cancelled
  
  error_code TEXT,                        -- código de error de Meta (ej: "131047")
  error_message TEXT,                     -- descripción del error
  
  -- IDs de tracking
  provider_message_id TEXT,              -- wamid de Meta (ej: "wamid.HBgL...")
  
  -- Timestamps del ciclo de vida
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Reintentos
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  next_retry_at TIMESTAMPTZ,
  
  UNIQUE(campaign_id, person_id)
);

-- Índice principal: Make.com consulta mensajes pendientes de una campaña
CREATE INDEX idx_queue_pending 
  ON broadcast_queue(campaign_id, status) 
  WHERE status = 'pending';

-- Índice para actualizar status por provider_message_id (webhook de Meta)
CREATE INDEX idx_queue_provider_msg 
  ON broadcast_queue(provider_message_id) 
  WHERE provider_message_id IS NOT NULL;
```

### 5.4 Tabla: `broadcast_config`

Configuración global del módulo de difusión.

```sql
CREATE TABLE broadcast_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO broadcast_config (key, value, description) VALUES
('meta_phone_number_id', '', 'Phone Number ID de Meta para envíos'),
('meta_waba_id', '', 'WhatsApp Business Account ID'),
('messaging_tier', '1', 'Tier actual: 1=250/día, 2=1K, 3=10K, 4=100K'),
('max_daily_marketing_messages', '250', 'Límite diario autoimpuesto para marketing'),
('batch_size', '50', 'Tamaño de lote para Make.com'),
('batch_delay_ms', '100', 'Delay entre mensajes en ms'),
('max_retries', '2', 'Reintentos máximos por mensaje fallido'),
('cost_per_marketing_template_ars', '0.047', 'Costo por template de marketing en USD (Sudamérica)'),
('cost_per_utility_template_ars', '0.019', 'Costo por template utility en USD'),
('templates_last_synced', '', 'Última sincronización de templates con Meta'),
('opt_out_tag', 'no_recibir_difusion', 'Tag en person_soft_data que excluye de difusión');
```

### 5.5 Vista: `broadcast_campaign_summary`

Vista materializada para dashboard.

```sql
CREATE OR REPLACE VIEW broadcast_campaign_summary AS
SELECT 
  bc.id,
  bc.name,
  bc.template_name,
  bc.template_category,
  bc.status,
  bc.total_recipients,
  bc.sent_count,
  bc.delivered_count,
  bc.read_count,
  bc.failed_count,
  bc.created_at,
  bc.started_at,
  bc.completed_at,
  
  -- Métricas calculadas
  CASE WHEN bc.sent_count > 0 
    THEN ROUND(bc.delivered_count::numeric / bc.sent_count * 100, 1)
    ELSE 0 
  END AS delivery_rate_pct,
  
  CASE WHEN bc.delivered_count > 0 
    THEN ROUND(bc.read_count::numeric / bc.delivered_count * 100, 1)
    ELSE 0 
  END AS read_rate_pct,
  
  CASE WHEN bc.total_recipients > 0 
    THEN ROUND(bc.failed_count::numeric / bc.total_recipients * 100, 1)
    ELSE 0 
  END AS failure_rate_pct,
  
  -- Costo estimado
  bc.estimated_cost_usd,
  
  -- Duración
  CASE WHEN bc.completed_at IS NOT NULL AND bc.started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM bc.completed_at - bc.started_at)::INTEGER
    ELSE NULL
  END AS duration_seconds,
  
  -- Tags usados como filtro
  bc.filter_tags,
  bc.campaign_tag
  
FROM broadcast_campaigns bc
ORDER BY bc.created_at DESC;
```

### 5.6 RPC: `get_broadcast_recipients`

```sql
CREATE OR REPLACE FUNCTION get_broadcast_recipients(
  p_include_tags TEXT[],
  p_exclude_tags TEXT[] DEFAULT '{}',
  p_location_filter TEXT DEFAULT 'all'
)
RETURNS TABLE (
  person_id INTEGER,
  phone_number TEXT,
  person_name TEXT,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT DISTINCT ON (p.id)
      p.id AS person_id,
      pc.contact_value AS phone_number,
      COALESCE(
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        pc.contact_value
      ) AS person_name
    FROM persons p
    JOIN person_contacts pc ON pc.person_id = p.id 
      AND pc.channel_provider_id IN (1, 4)
      AND pc.contact_value IS NOT NULL
      AND pc.contact_value != ''
      AND LENGTH(pc.contact_value) >= 10
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
      -- Excluir personas que pidieron no recibir difusión
      AND NOT EXISTS (
        SELECT 1 FROM person_soft_data psd_opt
        WHERE psd_opt.person_id = p.id
          AND psd_opt.data_name = 'opt_out_difusion'
          AND psd_opt.disabled IS NOT TRUE
      )
    ORDER BY p.id, pc.id  -- tomar el primer teléfono si hay varios
  )
  SELECT 
    e.person_id,
    e.phone_number,
    e.person_name,
    array_agg(DISTINCT psd2.data_content ORDER BY psd2.data_content) AS tags
  FROM eligible e
  JOIN person_soft_data psd2 ON psd2.person_id = e.person_id
    AND psd2.data_name = 'tag_curso_interes'
    AND psd2.disabled IS NOT TRUE
  GROUP BY e.person_id, e.phone_number, e.person_name
  ORDER BY e.person_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 5.7 Trigger: Actualizar contadores automáticamente

```sql
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Decrementar el contador del estado anterior
    IF OLD.status = 'sent' THEN
      UPDATE broadcast_campaigns SET sent_count = sent_count - 1 WHERE id = NEW.campaign_id;
    ELSIF OLD.status = 'delivered' THEN
      UPDATE broadcast_campaigns SET delivered_count = delivered_count - 1 WHERE id = NEW.campaign_id;
    ELSIF OLD.status = 'read' THEN
      UPDATE broadcast_campaigns SET read_count = read_count - 1 WHERE id = NEW.campaign_id;
    ELSIF OLD.status = 'failed' THEN
      UPDATE broadcast_campaigns SET failed_count = failed_count - 1 WHERE id = NEW.campaign_id;
    END IF;
    
    -- Incrementar el contador del nuevo estado
    IF NEW.status = 'sent' THEN
      UPDATE broadcast_campaigns 
      SET sent_count = sent_count + 1 
      WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'delivered' THEN
      UPDATE broadcast_campaigns 
      SET delivered_count = delivered_count + 1 
      WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'read' THEN
      UPDATE broadcast_campaigns 
      SET read_count = read_count + 1 
      WHERE id = NEW.campaign_id;
    ELSIF NEW.status = 'failed' THEN
      UPDATE broadcast_campaigns 
      SET failed_count = failed_count + 1 
      WHERE id = NEW.campaign_id;
    END IF;
    
    -- Si todos los mensajes están en estado final, completar la campaña
    IF NOT EXISTS (
      SELECT 1 FROM broadcast_queue 
      WHERE campaign_id = NEW.campaign_id 
        AND status IN ('pending', 'sending')
    ) THEN
      UPDATE broadcast_campaigns 
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.campaign_id AND status = 'sending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_broadcast_queue_status
  AFTER UPDATE OF status ON broadcast_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_counters();
```

---

## 6. Gestión de templates desde el CRM

### 6.1 Flujo de creación de template

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│ CRM: Editor │───▶│ EF: Validar +    │───▶│ Meta: Review │───▶│ CRM: Listo   │
│ de template │    │ POST a Meta API  │    │ (min a 48h)  │    │ para usar    │
│             │    │                  │    │              │    │              │
│ - Categoría │    │ - Validar format │    │ - ML review  │    │ - Mostrar en │
│ - Nombre    │    │ - Enviar a Meta  │    │ - APPROVED   │    │   selector   │
│ - Idioma    │    │ - Guardar como   │    │   o REJECTED │    │   de campaña │
│ - Body      │    │   PENDING en     │    │              │    │              │
│ - Header    │    │   cache local    │    │              │    │              │
│ - Footer    │    │                  │    │              │    │              │
│ - Botones   │    │                  │    │              │    │              │
│ - Samples   │    │                  │    │              │    │              │
└─────────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │  Webhook o  │
                                           │  sync cada  │
                                           │  30 min     │
                                           └─────────────┘
```

### 6.2 Sincronización de templates

La Edge Function `broadcast-templates` tiene una acción `sync` que:

1. Llama a `GET /{waba-id}/message_templates` con el token de Meta
2. Para cada template retornado, hace upsert en `broadcast_templates_cache`
3. Detecta templates que cambiaron de estado (APPROVED→PAUSED, etc.)
4. Retorna un diff al CRM si hay cambios relevantes

Esta sincronización se puede disparar:
- Al abrir la pantalla de templates en el CRM
- Al crear una nueva campaña (verificar que el template siga aprobado)
- Cada 30 minutos vía un escenario de Make.com (bajo costo: 2-3 operaciones)

### 6.3 Pre-aprobación y buenas prácticas

Meta ofrece algunas facilidades para acelerar la aprobación:

**Templates de utilidad** tienen aprobación casi instantánea si el contenido es claramente transaccional (confirmaciones, recordatorios).

**Templates de marketing** pasan por revisión ML más estricta. Para aumentar la probabilidad de aprobación:
- No usar todo mayúsculas
- No empezar ni terminar con un placeholder `{{1}}`
- Incluir sample values que demuestren el uso real
- No mencionar precios en los samples
- Usar el nombre del negocio en el footer

**Recomendación para IITA:** Crear un set base de templates genéricos reutilizables:

| Template | Categoría | Body | Parámetros |
|----------|-----------|------|------------|
| `inicio_curso_general` | Marketing | "Hola {{1}}, te contamos que el curso de {{2}} comienza el {{3}}. ¿Te gustaría inscribirte?" | nombre, curso, fecha |
| `recordatorio_clase` | Utility | "Hola {{1}}, te recordamos que tu clase de {{2}} es {{3}} a las {{4}}." | nombre, curso, día, hora |
| `becas_disponibles` | Marketing | "Hola {{1}}, hay becas disponibles para {{2}}. Consultá sin compromiso." | nombre, programa |
| `encuesta_satisfaccion` | Utility | "Hola {{1}}, queremos saber tu opinión sobre {{2}}. ¿Podés completar esta breve encuesta?" | nombre, curso |

---

## 7. Plan de implementación revisado

### Fase 1: Modelo de datos (1 día)
- [ ] Crear tablas: `broadcast_templates_cache`, `broadcast_campaigns`, `broadcast_queue`, `broadcast_config`
- [ ] Crear vista `broadcast_campaign_summary`
- [ ] Crear RPC `get_broadcast_recipients`
- [ ] Crear trigger `update_campaign_counters`
- [ ] Insertar configuración inicial en `broadcast_config`

### Fase 2: Edge Functions (2 días)
- [ ] Edge Function `broadcast-prepare` (acciones: prepare, start, progress, cancel)
- [ ] Edge Function `broadcast-templates` (acciones: sync, list, create, preview)
- [ ] Tests con template `hello_world` de Meta (viene pre-aprobado)

### Fase 3: Make.com (1 día)
- [ ] Escenario "Difusión WhatsApp" (polling de cola → envío → update status)
- [ ] Agregar router de status de broadcast al escenario de entrada existente
- [ ] Escenario "Sync Templates" (cada 30 min o on-demand)

### Fase 4: Frontend CRM (2-3 días)
- [ ] Pantalla: Lista de campañas con estados y métricas
- [ ] Pantalla: Crear campaña (selector template + filtros + preview + confirmación)
- [ ] Pantalla: Progreso de campaña (barra + contadores + detalle de fallos)
- [ ] Pantalla: Gestión de templates (lista, preview, crear nuevo)

### Fase 5: Testing y go-live (1 día)
- [ ] Test end-to-end con 10 contactos y template aprobado
- [ ] Verificar delivery status tracking
- [ ] Verificar tag de campaña
- [ ] Documentar en DATA-OPERATIONS.md

**Estimación total: 7-9 días**

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Template rechazado por Meta | Media | Bajo | Crear templates con anticipación, seguir guidelines, tener alternativas listas |
| Quality Rating baja por bloqueos | Baja | Alto | Limitar campañas a personas que hayan interactuado, respetar opt-out, monitorear métricas |
| Make.com supera límite de operaciones | Media | Medio | Monitorear uso, considerar upgrade de plan si hay campañas frecuentes |
| Token de Meta expira | Baja | Alto | Usar System User token permanente, alertar si hay errores 401 |
| Template pausado durante campaña | Baja | Alto | Verificar status antes de cada lote, pausar campaña automáticamente si template está PAUSED |
| Duplicación de mensajes | Baja | Medio | UNIQUE constraint en broadcast_queue + verificar antes de enviar |
