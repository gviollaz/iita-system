# Features del Sistema

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Features Implementadas

### FEAT-001 | Dashboard KPIs

- **Estado:** Implementado
- **Componente:** Frontend (Dashboard.jsx) + Supabase (RPCs de analytics)
- **Descripcion:** Panel principal con indicadores clave de gestion: total de conversaciones, mensajes por dia, distribusion por canal, leads mas activos. *(Nota Gemini 3: Los endpoints 'unanswered' y 'volume_by_provider' fueron retirados del dashboard en el codigo fuente)*.
- **Endpoints:** `stats`, `msgs_per_day`, `volume_by_channel`, `top_leads`, `branches`, `channels`, `channel_analysis`

---

### FEAT-002 | Chat de Conversaciones

- **Estado:** Implementado
- **Componente:** Frontend (Conversations.jsx) + Supabase (get_chat_detail, get_conversations)
- **Descripcion:** Vista de chat que muestra las conversaciones con mensajes, media adjunta, respuestas de IA y evaluacion. Soporta filtros por canal, estado y fecha.
- **Endpoints:** `get_conversations`, `get_chat_detail`, `approve_ai_response`, `branches`, `channels`

---

### FEAT-003 | Gestion de Personas

- **Estado:** Implementado
- **Componente:** Frontend (People.jsx) + Supabase (RPCs de personas)
- **Descripcion:** Lista paginada de personas/leads con busqueda por texto, perfil completo con historial de conversaciones y contactos por canal. *(Nota Gemini 3: La arquitectura del frontend migro para usar la vista enriquecida como principal en vez de listados separados)*.
- **Endpoints:** `persons_enriched`, `person_full`, `persons_filter_options`, `update_person`, `send_to_person`

---

### FEAT-018 | Monitoreo de Salud (Health)

- **Estado:** Implementado (No documentado previamente)
- **Componente:** Frontend (Health.jsx) + Supabase 
- **Descripcion:** Panel de monitoreo del estado de los canales y conexion a base de datos. *(Agregado por auditoria de codigo fuente - Gemini 3)*.
- **Endpoints:** `channel_health`

---

### FEAT-004 | ABM de Cursos

- **Estado:** Implementado
- **Componente:** Frontend (Courses.jsx) + Supabase (courses-crud Edge Function)
- **Descripcion:** Alta, baja y modificacion de cursos, ediciones y horarios. Tabla editable inline con GenericTable. Ciclo de estados: Enrolling -> Pending -> In_Progress -> Conclude -> Disabled.

---

### FEAT-005 | Pipeline Multicanal

- **Estado:** Implementado
- **Componente:** Make.com (117 escenarios, 43 activos)
- **Descripcion:** Pipeline de procesamiento de mensajes en 8 etapas: entrada, procesamiento, preprocesamiento, generacion IA, evaluacion, aprobacion, envio y monitoreo. Soporta WhatsApp Cloud API, WhatsApp Coexistence, Instagram, Messenger y Email.

---

### FEAT-006 | Prevencion de Duplicados y Ecos

- **Estado:** Implementado
- **Componente:** Supabase (triggers en PostgreSQL)
- **Descripcion:** Triggers de base de datos que previenen la creacion de conversaciones duplicadas (`prevent_duplicate_conversation` con `FOR UPDATE`) y mensajes eco (`prevent_echo_interaction`).
- **Resuelve:** BUG-R002, BUG-R003

---

### FEAT-007 | Visualizacion de Media

- **Estado:** Implementado
- **Componente:** Frontend (Lightbox.jsx) + Supabase (get_chat_detail con media_url)
- **Descripcion:** Visor de imagenes y video en el chat. Soporta media almacenada como base64 y URLs externas. Incluye lightbox para vista ampliada.
- **Resuelve:** BUG-R001

---

### FEAT-008 | Enriquecimiento con IA

- **Estado:** Implementado
- **Componente:** Supabase (person_soft_data, person_enrichment_log) + Make.com/Scripts
- **Descripcion:** Infraestructura para enriquecer datos de personas usando IA. Almacena datos key-value en `person_soft_data` con log de procesamiento en `person_enrichment_log`. Soporta ~1000 personas pendientes de procesamiento.

---

### FEAT-009 | Personas Enriquecidas con Filtros

- **Estado:** Implementado
- **Componente:** Frontend (People.jsx) + Supabase (get_persons_enriched, get_persons_filter_options)
- **Descripcion:** Vista enriquecida de personas con filtros dinamicos basados en datos de `person_soft_data`. Permite filtrar por campos predefinidos extraidos (tag de interes/curso, provincia, pais, telefono, email).
*(Nota: Corregido por Gemini 3 el 2026-02-20 - La funcion SQL solo acepta parametros especificos, no "cualquier campo" como indicaba la documentacion previa)*

---

## Features Planificadas

### FEAT-010 | Login con Supabase Auth

- **Estado:** Planificado
- **Prioridad:** P0
- **Componente:** Frontend + Supabase Auth
- **Descripcion:** Implementar autenticacion de usuarios en el CRM usando Supabase Auth. Formulario de login, manejo de sesion, envio de JWT en cada request a la API.
- **Dependencias:** Ninguna
- **Bloquea:** FEAT-011 (RBAC), BUG-011 (JWT en Edge Functions)

---

### FEAT-011 | RBAC (Control de Acceso por Roles)

- **Estado:** Planificado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase (tablas users, roles, permissions, branche_users)
- **Descripcion:** Implementar control de acceso basado en roles. Tres roles iniciales: admin, operador, viewer. Asignacion de usuarios a sedes. Filtrado de datos segun sede y rol del usuario logueado.
- **Dependencias:** FEAT-010 (Login)
- **Tablas involucradas:** `users`, `roles`, `permissions`, `role_permissions`, `branche_users` (actualmente vacias)

---

### FEAT-012 | Modulo de Pagos

- **Estado:** Planificado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase
- **Descripcion:** Implementar gestion de pagos vinculados a cursos. Tickets de pago, registro de pagos, logs de transacciones.
- **Tablas involucradas:** `payment_tickets`, `payments`, `payments_logs`, `course_tickets` (actualmente vacias)

---

### FEAT-013 | Inscripcion de Alumnos

- **Estado:** Planificado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase
- **Descripcion:** Vincular personas con ediciones de cursos a traves de la tabla `course_members`. Permitir inscribir alumnos desde el CRM y ver el listado de inscriptos por edicion.
- **Tablas involucradas:** `course_members` (actualmente vacia)
- **Dependencias:** FEAT-004 (ABM Cursos)

---

### FEAT-014 | Evaluacion Automatica de IA

- **Estado:** Planificado
- **Prioridad:** P2
- **Componente:** Make.com + CRM
- **Descripcion:** Implementar la Etapa 5 del pipeline (evaluacion): scoring automatico de confianza de las respuestas IA antes de la aprobacion manual. Las respuestas con alta confianza podrian auto-aprobarse.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)

---

### FEAT-015 | Auto-cancel de IA por Respuesta Humana

- **Estado:** Planificado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase
- **Descripcion:** Cuando un operador responde manualmente desde el telefono, cancelar automaticamente cualquier respuesta IA pendiente para esa conversacion. Evita que se envien respuestas IA despues de que un humano ya respondio.
- **Ver:** PROPUESTAS-PENDIENTES.md Propuesta #2

---

### FEAT-016 | Sesiones Virtuales

- **Estado:** Planificado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase
- **Descripcion:** Integrar tablas `virtual_sessions` y `session_recording` con plataforma de videoconferencia. Permitir programar, grabar y vincular sesiones virtuales con ediciones de cursos.
- **Tablas involucradas:** `virtual_sessions`, `session_recording`

---

### FEAT-017 | Migrar Media a Supabase Storage

- **Estado:** Planificado
- **Prioridad:** P1
- **Componente:** Make.com + Supabase Storage + Scripts de migracion
- **Descripcion:** Migrar el almacenamiento de media de base64 en la columna `medias.content_dir` a URLs en Supabase Storage. Reducir el consumo actual de 654+ MB en la base de datos. Incluye migracion de datos existentes.
- **Dependencias:** Ninguna

---

## Features Deseadas

Las features deseadas estan organizadas en grupos funcionales. Los IDs de FEAT se mantienen para trazabilidad.

### Mapa de dependencias entre grupos

```
Grupo A (Canales DMs) ←── depende de FEAT-005 (Pipeline)
Grupo B (Redes Sociales) ←── depende de APIs de cada plataforma
Grupo C (Canal Voz) ←── depende de proveedor VoIP + FEAT-040
Grupo D (Control IA) ←── depende de FEAT-005 (Pipeline)
Grupo E (Timing Mensajes) ←── depende de FEAT-005 + datos historicos
Grupo F (Marketing) ←── depende de FEAT-005 + APIs externas
Grupo G (Datos) ←── depende de FEAT-003 (Personas) + FEAT-008 (Enriquecimiento)
Grupo H (Operaciones) ←── depende de FEAT-002 (Chat) + FEAT-003 (Personas)
Grupo I (Monitoreo) ←── depende de FEAT-001 (Dashboard) + FEAT-018 (Health)
```

---

### Grupo A — Expansion de Canales de Mensajeria Directa

> **Objetivo:** Ampliar el pipeline multicanal con nuevos canales de DMs. Cada canal nuevo sigue el mismo patron de integracion: escenario de entrada en Make.com → `process_incoming_message` → generacion IA → aprobacion → envio. Los canales se registran en la tabla `channels` y el frontend los muestra automaticamente en filtros y selectores.

#### FEAT-019 | Canal TikTok — Mensajes Directos

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase
- **Descripcion:** Integrar TikTok como canal de mensajeria directa. TikTok es relevante para alcanzar audiencia joven interesada en cursos de marketing digital, diseno y tecnologia. La plataforma tiene mas de 1.5 mil millones de usuarios activos y su audiencia tiende a ser sub-30, un segmento clave para formacion profesional.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Viabilidad tecnica:** TikTok Login Kit + Content Posting API estan disponibles. Para mensajeria directa, la API es limitada — actualmente solo disponible para cuentas de empresa verificadas via TikTok for Business. Evaluar si el volumen de DMs justifica la integracion directa o si conviene redirigir a WA/IG desde la bio.
- **Notas:** Empezar con monitoreo de comentarios (Grupo B, FEAT-042) antes de DMs, ya que los comentarios en TikTok son mas frecuentes y accesibles via API.

#### FEAT-020 | Canal Discord

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase
- **Descripcion:** Agregar Discord como canal de comunicacion. Recibir mensajes directos y/o mensajes de canales de un servidor Discord, procesarlos a traves del pipeline multicanal.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Notas:** Discord tiene API de bots bien documentada. Se puede integrar via webhook a Make.com.

---

### FEAT-021 | Canal Sitio Web (Widget de Chat)

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase + Frontend (widget embebible)
- **Descripcion:** Agregar un canal de comunicacion via sitio web. Implementar un widget de chat embebible que se pueda insertar en el sitio web de IITA para que visitantes inicien conversaciones directamente. Los mensajes se procesan a traves del pipeline multicanal.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Notas:** Requiere desarrollar componente widget standalone (embebible via script tag o iframe).

---

### FEAT-022 | Canal YouTube (Mensajes Directos)

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase
- **Descripcion:** Agregar YouTube como canal de comunicacion. Recibir y responder mensajes directos del canal de YouTube de IITA a traves del pipeline multicanal.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Notas:** Requiere evaluar YouTube Data API y limitaciones de mensajeria directa.

---

### FEAT-023 | Vista de Mapa para Leads y Clientes

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Frontend + Supabase
- **Descripcion:** Agregar una vista de mapa interactivo que muestre la ubicacion geografica de leads y clientes actuales. Permitir filtrar por tipo (lead/cliente), provincia, estado, etc. Util para visualizar distribucion geografica y planificar estrategias regionales.
- **Dependencias:** FEAT-003 (Gestion de Personas), FEAT-009 (Personas Enriquecidas)
- **Notas:** Requiere datos de ubicacion en `person_soft_data` (provincia, pais, ciudad). Evaluar libreria de mapas (Leaflet, Mapbox, Google Maps).

---

### FEAT-024 | Rate Limiting y Control de Consumo de IA

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase
- **Descripcion:** Implementar un sistema de control de consumo de llamadas a APIs de IA (OpenAI, Claude, etc.) que administre rate limits por minuto, por hora y por dia. El sistema debe: (1) trackear el consumo en tiempo real, (2) suspender o ralentizar pedidos antes de alcanzar los limites de la API, (3) redirigir pedidos a un proveedor de IA alternativo cuando el principal esta cerca del limite (fallback automatico), (4) alertar cuando se acerque a umbrales criticos de gasto.
- **Dependencias:** FEAT-005 (Pipeline Multicanal), FEAT-014 (Evaluacion Automatica IA)
- **Notas:** Considerar tabla de tracking `ai_usage_log` con contadores por proveedor/modelo/periodo. Make.com puede implementar la logica de routing entre proveedores. Evaluar si el throttling se hace en Make.com (antes de llamar a la API) o en una Edge Function dedicada.

---

### FEAT-025 | Control de Ventanas de Tiempo por Canal y Estadisticas de Vencimiento

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase + Make.com
- **Descripcion:** Implementar un sistema integral de control de ventanas de tiempo para mensajes salientes por canal. Cada canal tiene sus propias reglas de tiempo (ej: WhatsApp y Messenger limitan a 24hs desde el ultimo mensaje del usuario para enviar texto libre; Instagram tiene reglas similares). El sistema debe: (1) configurar reglas de tiempo por canal (ventana maxima, restricciones, costo post-vencimiento), (2) monitorear en tiempo real el estado de cada conversacion activa, (3) mostrar alertas en el frontend para mensajes proximos a vencer con posibilidad de responder rapidamente antes del vencimiento, (4) bloquear o advertir envios cuando la ventana ya vencio, (5) generar estadisticas de mensajes vencidos (cuantos vencieron, por canal, por operador, por dia/semana/mes).
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Relacionado:** RFC-005 (Alertas de ventana 24hs — diseno tecnico detallado para WA/Messenger/IG)
- **Frontend requerido:**
  - Panel de alertas en Conversations con categorias: critico (< 2h), urgente (2-10h), ok (> 10h), vencida
  - Accion rapida "Responder ahora" / "Aprobar IA pendiente" desde la alerta
  - Dashboard de estadisticas de vencimiento: mensajes vencidos por canal, por periodo, tendencia temporal
  - Indicador visual en cada conversacion mostrando tiempo restante de ventana
- **Backend requerido:**
  - Tabla `channel_time_rules` con reglas configurables por canal (ventana_horas, tipo_restriccion, costo_post_vencimiento)
  - RPC `get_window_status()` que calcule el estado de ventana de todas las conversaciones activas (diseño en RFC-005)
  - RPC para estadisticas de vencimiento (mensajes vencidos agrupados por canal/periodo)
  - Monitoreo periodico (Make.com cada hora) con notificaciones externas para conversaciones criticas
- **Notas:** Ver RFC-005 para el diseno tecnico detallado de la funcion `get_window_status()` y las opciones de implementacion en frontend. Las reglas deben ser extensibles para los canales futuros (FEAT-019 a FEAT-022). Considerar que canales como email no tienen restriccion de ventana.

---

### FEAT-026 | Mensajeria Alternativa Fuera de Ventana (Canales No Oficiales / Terceros)

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase + Integraciones externas
- **Descripcion:** Implementar mecanismos alternativos para enviar mensajes fuera de la ventana de tiempo oficial de cada canal. Cuando la ventana de WhatsApp/Instagram/Messenger vence y no se puede usar un template oficial (o no conviene por costo), el sistema debe poder recurrir a vias alternativas para enviar una cantidad limitada de mensajes. Opciones a evaluar: (1) APIs de terceros o proveedores alternativos de mensajeria (ej: proveedores no oficiales de WA, plataformas de engagement), (2) web scraping controlado de interfaces web de mensajeria, (3) automatizacion de interfaz via herramientas tipo Puppeteer/Selenium, (4) envio por canal alternativo disponible (ej: si WA vencio pero tiene email, enviar por email), (5) SMS como fallback para mensajes urgentes. Tambien debe servir para iniciar campanas de marketing a contactos sin ventana abierta, complementando RFC-004.
- **Dependencias:** FEAT-025 (Control de ventanas), FEAT-005 (Pipeline Multicanal)
- **Relacionado:** RFC-004 (Campanas de marketing — seleccion de canal por persona)
- **Consideraciones:**
  - **Riesgo de bloqueo:** El uso de APIs no oficiales o webscraping puede violar TOS de las plataformas y resultar en bloqueo de cuentas. Debe usarse con volumen bajo y con precauciones.
  - **Volumen limitado:** Esta solucion es para pocos mensajes de alto valor (leads calientes, seguimiento critico), no para envios masivos.
  - **Fallback inteligente:** El sistema debe elegir automaticamente la mejor via alternativa disponible: canal alternativo oficial (email/SMS) > template oficial > API de tercero > otros.
  - **Registro completo:** Cada mensaje enviado por via alternativa debe quedar registrado en `interactions` con metadata del metodo usado.
  - **Configuracion por canal:** Cada canal debe tener configurado cuales alternativas estan habilitadas y cuales no.
- **Notas:** Evaluar proveedores como Twilio (SMS), herramientas de automatizacion web, y APIs no oficiales. Documentar riesgos de cada alternativa. Empezar con la opcion menos riesgosa (fallback a email/SMS) antes de explorar opciones mas agresivas.

---

### FEAT-027 | Optimizacion Inteligente de Horarios de Envio

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase + Frontend
- **Descripcion:** Implementar un sistema que determine y administre los mejores horarios para enviar mensajes de seguimiento y campanas de marketing. El sistema debe: (1) analizar patrones de actividad historica por persona (a que hora suele escribir, a que hora responde mas rapido), (2) calcular horarios optimos globales por canal (ej: WA tiene mas engagement a las 10am y 7pm), (3) programar envios en la franja horaria optima en vez de enviar inmediatamente, (4) respetar horarios razonables (no enviar de madrugada), (5) permitir configurar reglas por persona o usar el default global.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Relacionado:** RFC-004 (Campanas — programacion de envios), FEAT-025 (Ventanas de tiempo)
- **Backend requerido:**
  - Tabla `send_time_preferences` con reglas por persona o globales (horario_inicio, horario_fin, dias_preferidos, zona_horaria)
  - RPC de analisis: calcular horario optimo por persona basado en historial de `interactions` (hora de mensajes entrantes, tiempo de respuesta)
  - RPC de analisis global: mejor horario por canal basado en agregados de todas las interacciones
  - Cola de envio con scheduling: los mensajes no se envian inmediatamente sino que se programan para el proximo horario optimo
- **Frontend requerido:**
  - Visualizacion del horario optimo por persona en su perfil (heatmap de actividad)
  - Configuracion de reglas globales de horarios (admin)
  - En campanas: opcion "Enviar en horario optimo" vs "Enviar ahora"
  - Estadisticas de engagement por franja horaria
- **Notas:** Empezar con reglas globales simples (no enviar antes de 8am ni despues de 10pm, zona horaria Argentina). Luego agregar analisis por persona cuando haya suficiente historial. El heatmap de actividad puede calcularse con un query sobre `interactions` agrupado por hora del dia y dia de la semana.

---

### FEAT-028 | Silenciar IA por Persona — Modo "Canal Manual"

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase + Make.com
- **Descripcion:** Agregar la posibilidad de silenciar la generacion de respuestas de IA para una persona especifica, de forma temporal o permanente, directamente desde el flujo de aprobacion de respuestas. Ademas de las acciones actuales (aceptar, editar, rechazar), el operador debe poder marcar a esa persona como "canal manual": la IA deja de generar respuestas completamente para ese contacto, ahorrando tiempo de procesamiento y costo de API. Opciones: (1) silenciar IA temporalmente (ej: 1h, 24h, 1 semana), (2) silenciar IA permanentemente para esa persona, (3) reactivar IA cuando sea necesario. Cuando la IA esta silenciada, el sistema no debe gastar recursos generando respuestas que nadie va a usar.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Relacionado:** RFC-003 (Control de generacion de respuestas — diseno tecnico completo con funcion `should_generate_ai_response()`)
- **Frontend requerido:**
  - En el panel de aprobacion de respuestas IA: nueva accion "Silenciar IA" junto a aceptar/editar/rechazar
  - Opciones de silenciamiento: temporal (1h, 24h, 1 semana) o permanente
  - Campo de motivo (ej: "alumno inscripto", "gestion manual", "pidio no recibir automaticos")
  - Indicador visual en la conversacion y en el listado de personas cuando la IA esta silenciada
  - En el perfil de persona: toggle de IA con estado visible y motivo
  - Filtro en listado de personas: "Personas con IA silenciada"
- **Backend requerido:**
  - Campos en `persons`: `ai_enabled`, `ai_disabled_reason`, `ai_disabled_at`, `ai_disabled_by` (ver RFC-003)
  - Campos en `conversations`: `ai_enabled`, `ai_paused_until`, `ai_paused_reason` (ver RFC-003)
  - RPC `should_generate_ai_response(conversation_id)` — Make.com la consulta antes de generar IA
  - Make.com debe verificar el flag ANTES de llamar a la API de IA (ahorro real de costo y tiempo)
  - Al silenciar, cancelar automaticamente respuestas IA pendientes (`pending`) para esa persona
- **Notas:** RFC-003 tiene el diseno tecnico completo incluyendo SQL, endpoints y cambios en Make.com. El punto clave del usuario es que esta accion debe ser accesible directamente desde el flujo de aprobacion (no solo desde un menu separado), y que al marcar "canal manual" el sistema no desperdicie recursos generando respuestas. Considerar que las respuestas `pending` existentes se cancelen automaticamente al silenciar.

---

### FEAT-029 | Composicion de Mensajes con Asistente IA y Adjuntos

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase + Edge Functions
- **Descripcion:** Mejorar la pantalla de envio de mensajes en el chat para que el operador pueda: (1) escribir texto libre y enviarlo directamente, (2) adjuntar archivos (imagenes, PDFs, documentos), (3) solicitar a la IA que genere un borrador de mensaje a partir de un prompt escrito en el momento (ej: "dar informacion sobre cursos de marketing"). La IA genera el mensaje usando como contexto: el historial de la conversacion, los datos conocidos del cliente (`person_soft_data`), el catalogo de cursos, y el prompt del operador. El borrador generado se muestra en el editor para que el operador lo edite, apruebe o rechace antes de enviarlo. Esto convierte la IA de reactiva (solo responde a mensajes entrantes) a proactiva (el operador la invoca cuando la necesita).
- **Dependencias:** FEAT-002 (Chat de Conversaciones), FEAT-005 (Pipeline Multicanal)
- **Frontend requerido:**
  - Caja de composicion mejorada en el panel de chat con tres modos:
    - **Texto libre:** escribir y enviar directamente (input basico actual mejorado)
    - **Adjuntar archivo:** boton para subir imagenes, PDFs, documentos a Supabase Storage y adjuntar al mensaje
    - **Generar con IA:** campo de prompt donde el operador describe que quiere decir, boton "Generar", la IA produce un borrador que aparece en el editor de texto para revisar/editar antes de enviar
  - El borrador de IA debe mostrarse claramente como "borrador" (diferenciado visualmente) hasta que el operador lo apruebe
  - Historial de prompts recientes o prompts frecuentes sugeridos (ej: "informar sobre curso X", "seguimiento de inscripcion", "responder consulta de precio")
- **Backend requerido:**
  - Endpoint `generate_draft` en Edge Function o Make.com que reciba: `conversation_id`, `person_id`, `prompt` del operador
  - La generacion debe incluir como contexto: ultimos N mensajes de la conversacion, datos del cliente de `person_soft_data` (nombre, interes, provincia, historial), catalogo de cursos relevantes
  - El borrador generado NO se envia automaticamente, se retorna al frontend para edicion
  - Endpoint para enviar mensaje con adjuntos (subir a Storage + crear interaccion saliente)
- **Notas:** Actualmente la IA solo genera respuestas reactivas (ante mensaje entrante). Esta feature le da al operador el poder de invocar la IA on-demand, con contexto completo, para componer mensajes proactivos personalizados. Es especialmente util para seguimiento de leads, informacion de cursos, y recontacto. La IA puede usar el mismo modelo que ya se usa en el pipeline (GPT-4o o Claude) pero con un prompt distinto orientado a composicion asistida.

---

### FEAT-030 | Dashboard de Costos Operativos (IA, Make.com, Canales)

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase + Make.com
- **Descripcion:** Implementar un sistema de tracking y visualizacion de costos operativos del sistema. Registrar y mostrar costos de: (1) llamadas a APIs de IA (OpenAI, Claude) — por modelo, por cantidad de tokens, por tipo de uso (respuesta reactiva, composicion on-demand, enriquecimiento), (2) operaciones de Make.com — por escenario, por cantidad de ejecuciones, (3) envios por canal — costo de templates WA, SMS via Twilio, etc., (4) almacenamiento — Supabase Storage, base de datos. El dashboard debe mostrar costos acumulados por dia/semana/mes, tendencia temporal, costo promedio por conversacion, costo promedio por lead convertido, y alertas cuando se acerque a umbrales de presupuesto.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Relacionado:** FEAT-024 (Rate limiting IA — comparte tabla de tracking de uso)
- **Backend requerido:**
  - Tabla `cost_tracking` con registros por evento: `(timestamp, source, category, model, tokens_in, tokens_out, cost_usd, metadata)`
  - Sources: `openai`, `anthropic`, `make`, `whatsapp`, `twilio`, `supabase`
  - Categories: `ai_reactive` (respuesta a mensaje), `ai_proactive` (composicion on-demand), `ai_enrichment` (enriquecimiento de datos), `channel_send` (envio por canal), `automation` (ejecucion Make.com), `storage`
  - RPC para estadisticas agregadas: costo por periodo, por source, por category
  - Make.com registra costo despues de cada llamada a IA (tokens usados * precio por token)
  - Webhook o proceso batch para importar costos de Make.com (API de Make.com reporta operaciones consumidas)
- **Frontend requerido:**
  - Nueva seccion en Dashboard o pagina dedicada "Costos"
  - Grafico de costos acumulados por dia/semana/mes
  - Desglose por categoria (IA, canales, automatizaciones, storage)
  - Costo promedio por conversacion y por lead convertido
  - Alertas de presupuesto configurables (ej: "alerta si IA supera $50/dia")
  - Tabla detallada con filtros por fecha, source, category
- **Notas:** Los costos de IA se pueden calcular en Make.com despues de cada llamada (OpenAI devuelve tokens usados en la respuesta; para Claude usar estimacion por caracteres). Los costos de Make.com se obtienen via su API de billing. Los costos de WA templates son conocidos (~$0.05-0.15 por conversacion segun region). Empezar trackeando solo costos de IA (el mas variable y costoso) y luego agregar los demas.

---

### FEAT-031 | Banco de Respuestas Pre-generadas para Leads Nuevos

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase + Frontend
- **Descripcion:** Crear un banco de respuestas pre-generadas y aprobadas para los tipos de consulta mas frecuentes de leads nuevos (primera interaccion). En lugar de generar una respuesta IA personalizada para cada nuevo lead — que es costoso y lento — el sistema busca en el banco de respuestas una que coincida con el tema de la consulta y la usa directamente (o con minimas personalizaciones como el nombre). Para leads con historial, se sigue usando generacion personalizada. Esto reduce costos de IA, acelera el tiempo de respuesta, y garantiza calidad consistente en las primeras respuestas.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Relacionado:** FEAT-024 (Rate limiting IA — reduce consumo), FEAT-030 (Costos — reduce gasto en IA)
- **Backend requerido:**
  - Tabla `response_templates`: `(id, category, topic, trigger_keywords[], template_body, variables[], times_used, avg_approval_rate, is_active, created_at, updated_at, created_by)`
  - Categories: `consulta_curso`, `consulta_precio`, `consulta_inscripcion`, `consulta_horario`, `saludo_generico`, `consulta_certificado`, etc.
  - Variables soportadas: `{nombre}`, `{curso}`, `{precio}`, `{fecha_inicio}`, `{sede}`, etc.
  - RPC `find_matching_template(message_body, conversation_id)`: busca la mejor respuesta en el banco, usando keywords y/o embeddings semanticos
  - Logica de decision en Make.com:
    - Si es lead nuevo (primera interaccion) Y hay template que matchea → usar template (gratis, rapido)
    - Si es lead nuevo Y no hay template → generar con IA (como ahora)
    - Si es lead con historial (2+ interacciones) → siempre generar personalizado con IA
  - Tracking de uso: cuantas veces se uso cada template, tasa de aprobacion, para ir mejorando el banco
- **Frontend requerido:**
  - Pagina de administracion del banco de respuestas: CRUD de templates con preview
  - Sugerencia automatica: cuando la IA genera una respuesta para un lead nuevo que se aprueba, ofrecer "Guardar como template" para alimentar el banco
  - Estadisticas del banco: templates mas usados, tasa de aprobacion, ahorro estimado vs generacion IA
- **Notas:** El banco se puede alimentar de dos formas: (1) manualmente — un operador crea templates para las consultas mas frecuentes, (2) automaticamente — cuando una respuesta IA para un lead nuevo se aprueba sin editar, se sugiere guardarla como template. Con el tiempo el banco crece organicamente. El matching puede empezar simple (keywords) y evolucionar a semantico (embeddings). Considerar que las respuestas del banco aun pasan por el flujo de aprobacion (no se envian automaticamente sin revision).

---

### FEAT-032 | Reactivacion Automatica de Conversaciones Sin Respuesta

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Make.com + Supabase + Frontend
- **Descripcion:** Implementar un proceso automatico (cron) que detecte conversaciones donde se envio un mensaje saliente y el lead no respondio dentro de un plazo configurable (ej: 12 horas). Para esas conversaciones, el sistema genera automaticamente un mensaje de seguimiento/reactivacion — contextualizado al tema de la conversacion — y lo pone en cola para revision o envio. El objetivo es recuperar leads que se "enfriaron" antes de que la ventana de 24hs expire, manteniendo la conversacion activa. Este proceso debe respetar: (1) ventanas de tiempo del canal (FEAT-025), (2) si la persona tiene IA silenciada (FEAT-028), (3) horarios razonables de envio (FEAT-027), (4) un limite maximo de intentos de reactivacion por conversacion.
- **Dependencias:** FEAT-005 (Pipeline Multicanal), FEAT-025 (Ventanas de tiempo)
- **Relacionado:** RFC-005 (Alertas de ventana 24hs), FEAT-027 (Horarios optimos), FEAT-028 (Silenciar IA)
- **Backend requerido:**
  - RPC `get_stale_conversations(hours_threshold, max_reactivations)`: retorna conversaciones donde el ultimo mensaje fue saliente, hace mas de X horas, sin respuesta del lead, con ventana aun abierta, y que no superaron el limite de intentos de reactivacion
  - Tabla o campo `reactivation_count` en `conversations` para trackear cuantos seguimientos automaticos se hicieron (evitar spam)
  - Configuracion global: `stale_threshold_hours` (default 12), `max_reactivations` (default 2), `reactivation_cooldown_hours` (minimo entre intentos)
  - Escenario Make.com programado (cron cada 1-2 horas):
    1. Llamar a `get_stale_conversations()`
    2. Para cada conversacion: generar mensaje de seguimiento con IA (usando contexto de la conversacion)
    3. Crear `ai_interaction` con evaluation `pending` para que el operador apruebe
    4. Incrementar `reactivation_count`
  - Alternativa: usar banco de respuestas (FEAT-031) para seguimientos genericos en vez de generar con IA cada vez
- **Frontend requerido:**
  - Indicador en la lista de conversaciones: "Sin respuesta hace 14h" (badge o icono)
  - Filtro en Conversations: "Conversaciones sin respuesta" / "Esperando respuesta del lead"
  - Configuracion del cron en pagina de admin: threshold de horas, max intentos, horarios permitidos
  - Estadisticas: tasa de reactivacion exitosa (lead respondio despues del seguimiento), por canal, por periodo
- **Notas:** El mensaje de reactivacion debe ser contextual y natural, no generico. Ej: si el lead pregunto por un curso de marketing y no respondio, el seguimiento podria ser "Hola [nombre]! Te queria comentar que quedan pocos lugares para el curso de Marketing Digital. Te interesa que te reserve un lugar?". El limite de max_reactivations es critico para no convertir esto en spam. Considerar que este proceso se complementa con FEAT-025 (alertas de ventana): las conversaciones "stale" con ventana por vencer son las de mayor prioridad.

---

### FEAT-033 | Campanas de Marketing Pago en Meta (Ads Automatizados por Calendario)

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase + Frontend + Meta Ads API
- **Descripcion:** Implementar la gestion de campanas de publicidad paga en Meta (Facebook/Instagram Ads) desde el CRM, con automatizacion basada en etiquetas de cursos y calendario academico. El sistema debe permitir: (1) configurar campanas de Meta Ads vinculadas a cursos/ediciones con fechas de inicio y fin, (2) disparar automaticamente las campanas en fechas programadas del ano (ej: 30 dias antes del inicio de un curso), (3) segmentar la audiencia usando etiquetas del CRM (interes, ubicacion, historial), (4) crear audiencias personalizadas en Meta usando datos del CRM (Custom Audiences), (5) trackear el retorno: cuando un lead llega via ad, vincularlo con la campana paga y medir conversion (consulta → inscripcion). El flujo seria: curso programado → campaña se activa automaticamente → Meta muestra anuncios → leads llegan por WA/IG/Messenger → el CRM los identifica como provenientes del ad → seguimiento normal del pipeline.
- **Dependencias:** FEAT-005 (Pipeline Multicanal), FEAT-004 (ABM Cursos)
- **Relacionado:** RFC-004 (Campanas de marketing organico), FEAT-030 (Costos — tracking de gasto en ads)
- **Backend requerido:**
  - Tabla `ad_campaigns`: `(id, course_edition_id, platform, status, budget_usd, start_date, end_date, target_tags[], target_locations[], meta_campaign_id, meta_adset_id, impressions, clicks, leads_generated, cost_spent, created_at)`
  - Tabla `ad_campaign_rules`: reglas automaticas tipo "30 dias antes de inicio de edicion con estado Enrolling, crear campana con budget X y tags Y"
  - Integracion con Meta Marketing API via Make.com:
    - Crear/pausar/reanudar campanas
    - Subir Custom Audiences (lista de emails/telefonos del CRM segmentados por etiquetas)
    - Leer metricas (impresiones, clicks, costo)
  - Vinculacion de leads entrantes con campanas: cuando un lead llega via ad (parametro `ad_id` en la interaccion), asociarlo a la `ad_campaign` correspondiente
  - Cron en Make.com que evalua reglas de `ad_campaign_rules` diariamente y dispara campanas cuando corresponde
- **Frontend requerido:**
  - Pagina de administracion de campanas pagas: lista, crear, editar, pausar
  - Configuracion de reglas automaticas: "Para curso tipo [etiqueta], crear campana [X dias] antes del inicio"
  - Dashboard de ROI: gasto en ads vs leads generados vs inscriptos, por curso y por campana
  - Vinculacion visual: en el perfil de una persona, mostrar si llego via ad pago y de que campana
- **Notas:** Meta Marketing API requiere un App de Facebook verificada y tokens de acceso de larga duracion. Los Custom Audiences permiten subir listas de contactos (hash de email/telefono) para targeting preciso. Las reglas automaticas basadas en calendario academico (`course_editions.start_date`) permiten que las campanas se disparen sin intervencion manual. El tracking de `ad_id` ya existe parcialmente en el pipeline (BUG-006 menciona que falta en algunos flujos). Considerar integracion con Google Ads como fase futura.

---

### FEAT-034 | Enriquecimiento de Datos desde Fuentes Externas (LinkedIn, APIs, Web Scraping)

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Make.com + Supabase + Scripts
- **Descripcion:** Implementar herramientas para enriquecer automaticamente los datos de leads y personas con informacion de fuentes externas. Fuentes a considerar: (1) LinkedIn — perfil profesional, cargo, empresa, habilidades (via scraping controlado, API oficial, o servicios como Proxycurl/PhantomBuster), (2) APIs de enriquecimiento de datos (Clearbit, Hunter.io, Apollo.io) — email, empresa, perfil social, (3) busqueda web automatizada — Google Search API para encontrar perfiles publicos, (4) redes sociales publicas — informacion de perfil de Instagram/Facebook si es publica. Los datos obtenidos se almacenan en `person_soft_data` con la fuente claramente identificada. El proceso puede correr en batch (enriquecer todos los leads pendientes) o on-demand (enriquecer un lead especifico desde su perfil en el CRM).
- **Dependencias:** FEAT-008 (Enriquecimiento con IA — infraestructura existente en `person_soft_data`)
- **Relacionado:** FEAT-009 (Personas Enriquecidas — los filtros ya soportan datos de `person_soft_data`)
- **Backend requerido:**
  - Tabla `enrichment_sources`: configuracion de fuentes externas habilitadas, API keys, limites de uso, costo por consulta
  - Tabla `enrichment_queue`: cola de leads pendientes de enriquecer, con prioridad y fuente objetivo
  - Campos en `person_soft_data`: nuevas keys como `linkedin_url`, `linkedin_cargo`, `linkedin_empresa`, `linkedin_habilidades`, `enrichment_source`, `enrichment_date`
  - Escenarios Make.com por fuente:
    - LinkedIn enrichment: recibe persona, busca por nombre+email, extrae datos del perfil
    - API enrichment: llama a Clearbit/Apollo/Hunter con email, guarda resultados
    - Web search enrichment: busca en Google, parsea resultados relevantes
  - Cron batch: procesa cola de enriquecimiento en background (respetando rate limits de cada fuente)
  - Deduplicacion: si ya tiene datos de esa fuente con menos de X dias, no re-enriquecer
- **Frontend requerido:**
  - En perfil de persona: boton "Enriquecer datos" con selector de fuente
  - Seccion de datos externos en el perfil: mostrar datos de LinkedIn, empresa, etc.
  - Pagina de admin: configuracion de fuentes, API keys, limites
  - Proceso batch: "Enriquecer todos los leads sin datos de LinkedIn" con progreso
- **Notas:** LinkedIn es la fuente mas valiosa pero tambien la mas dificil de acceder. Opciones: (a) LinkedIn API oficial (requiere partnership, limitada), (b) servicios de terceros como Proxycurl ($0.01/perfil), PhantomBuster, (c) scraping manual (riesgo de bloqueo). Empezar con las fuentes mas faciles (APIs de enriquecimiento por email) y luego avanzar a LinkedIn. El enriquecimiento por IA (FEAT-008) ya existe y extrae datos de las conversaciones; esta feature agrega datos de fuentes externas que complementan.

---

### FEAT-035 | Importacion de Datos desde Moodle y Otras Fuentes Externas

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Make.com + Supabase + Frontend + Scripts
- **Descripcion:** Implementar un sistema de importacion de datos desde fuentes externas, principalmente Moodle (plataforma de cursos online de IITA) y archivos CSV/Excel de otras fuentes. El caso principal es importar alumnos de Moodle: estos son personas que ya completaron cursos y deben estar en el CRM como clientes/alumnos con su historial academico. El sistema debe: (1) conectarse a Moodle via API o exportacion de datos para obtener listado de alumnos, cursos completados, notas, fechas, (2) importar archivos CSV/Excel con listas de alumnos de otros cursos o fuentes (ej: planillas de inscripcion manuales), (3) matchear personas importadas con las existentes en el CRM (por email, telefono, nombre) para evitar duplicados, (4) crear personas nuevas cuando no haya match, (5) vincular personas importadas con los cursos/ediciones correspondientes en `course_members`, (6) enriquecer `person_soft_data` con datos academicos (cursos completados, notas, estado).
- **Dependencias:** FEAT-004 (ABM Cursos), FEAT-013 (Inscripcion de Alumnos)
- **Relacionado:** FEAT-008 (Enriquecimiento con IA), FEAT-034 (Enriquecimiento externo)
- **Backend requerido:**
  - Integracion con Moodle:
    - Conexion via Moodle Web Services API (REST) o exportacion periodica de datos
    - Mapeo de campos Moodle → CRM: `username` → email, `firstname`/`lastname` → nombre, cursos completados → `course_members`
    - Tabla `import_log`: registro de cada importacion (fecha, fuente, registros procesados, creados, actualizados, errores)
    - Tabla `import_mappings`: configuracion de mapeo de campos por fuente
  - Importacion de archivos:
    - Endpoint para subir CSV/Excel
    - Parser que detecta columnas y sugiere mapeo a campos del CRM
    - Preview de datos antes de importar (mostrar primeras filas, matches encontrados, nuevos a crear)
    - Proceso de importacion con rollback en caso de error
  - Deduplicacion inteligente:
    - Match por email exacto (prioridad 1)
    - Match por telefono normalizado (prioridad 2)
    - Match por nombre fuzzy + algun dato adicional (prioridad 3)
    - Para matches ambiguos: mostrar al operador para decision manual
  - Cron de sincronizacion con Moodle: importacion periodica automatica (ej: diaria) de nuevos alumnos y cursos completados
- **Frontend requerido:**
  - Pagina de importacion con wizard:
    1. Seleccionar fuente: Moodle (automatico) | Archivo CSV/Excel (manual)
    2. Para archivo: subir archivo, detectar columnas, mapear campos
    3. Preview: mostrar datos a importar, matches encontrados, conflictos
    4. Confirmar e importar
    5. Resultado: creados, actualizados, errores, duplicados resueltos
  - Historial de importaciones con detalles
  - Configuracion de sincronizacion Moodle (URL, token, frecuencia)
  - Indicador en perfil de persona: "Importado desde Moodle" / "Importado desde archivo X"
- **Notas:** Moodle expone una API REST bien documentada (`/webservice/rest/server.php`). Las funciones mas relevantes son `core_user_get_users`, `core_enrol_get_users_courses`, `gradereport_user_get_grade_items`. Se necesita un token de servicio web configurado en Moodle con los permisos adecuados. Para archivos CSV/Excel, la importacion debe ser lo suficientemente flexible para aceptar distintos formatos (cada planilla puede tener columnas diferentes). La deduplicacion es critica: importar 200 alumnos de Moodle no debe crear 200 personas nuevas si muchos ya estan como leads en el CRM.

---

### FEAT-036 | Deteccion de Leads Duplicados y Unificacion de Perfiles Multi-Canal

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase + Scripts
- **Descripcion:** Implementar un sistema de deteccion y unificacion de personas duplicadas en la base de datos. Actualmente un mismo lead puede existir como 2 o 3 registros separados si contacto por distintos canales (uno por WhatsApp, otro por Instagram, otro por Messenger). El sistema debe: (1) correr un proceso de deteccion que identifique posibles duplicados usando multiples criterios (nombre similar, mismo telefono, mismo email, mismo perfil social), (2) presentar al operador los duplicados encontrados para confirmar la unificacion, (3) mergear los registros: conservar un perfil principal y reasignar todas las conversaciones, interacciones, datos enriquecidos y relaciones del duplicado al perfil principal, (4) establecer un canal preferido por persona, (5) mostrar una vista unificada de todas las conversaciones de un lead independientemente del canal. Despues de la unificacion, el perfil de la persona muestra TODAS sus conversaciones (WA + IG + Messenger + etc.) en una sola linea temporal.
- **Dependencias:** FEAT-003 (Gestion de Personas)
- **Relacionado:** FEAT-035 (Importacion Moodle — comparte logica de deduplicacion)
- **Backend requerido:**
  - RPC `find_duplicate_persons()` que identifique posibles duplicados usando:
    - Match por telefono normalizado (quitar prefijos, espacios, guiones)
    - Match por email exacto (case insensitive)
    - Match por nombre fuzzy (Levenshtein o trigram similarity con `pg_trgm`)
    - Match por datos de `person_soft_data` (mismo perfil social, misma empresa)
    - Retorna pares de posibles duplicados con score de confianza y motivo del match
  - RPC `merge_persons(primary_id, duplicate_id)` que:
    - Reasigna `person_conversation` del duplicado al primario
    - Reasigna `person_soft_data` del duplicado al primario (sin sobreescribir datos existentes)
    - Reasigna `course_members`, `payment_tickets`, y otras relaciones
    - Mergea datos basicos: si el primario no tiene email pero el duplicado si, tomarlo
    - Crea registro en `merge_log`: quien mergeo, cuando, que datos se movieron
    - Soft-delete del duplicado (marcar como `merged_into = primary_id` en vez de borrar)
  - Campo `preferred_channel_id` en `persons`: canal preferido para contactar a esta persona
  - Campo `merged_into` en `persons`: si esta persona fue mergeada, apunta al perfil principal
  - Cron de deteccion: correr periodicamente para detectar nuevos duplicados (ej: semanalmente)
- **Frontend requerido:**
  - Pagina/seccion de "Duplicados detectados":
    - Lista de pares de posibles duplicados con score de confianza
    - Comparacion lado a lado de los dos perfiles (datos, conversaciones, canales)
    - Acciones: "Unificar" (elegir cual es el principal), "No es duplicado" (ignorar par), "Revisar despues"
  - En perfil de persona unificado:
    - Vista de timeline unificada de TODAS las conversaciones (WA + IG + Messenger + Email) ordenadas cronologicamente
    - Indicador de canal en cada conversacion/mensaje
    - Selector de canal preferido con fallback automatico
    - Badge "Perfil unificado" si tiene conversaciones en multiples canales
  - En el chat: poder cambiar de canal sin salir de la conversacion (ej: estoy viendo WA pero quiero enviar por IG)
  - Estadisticas: cantidad de duplicados detectados, mergeados, pendientes
- **Notas:** La deteccion de duplicados es especialmente importante porque el pipeline de Make.com crea personas por canal: si Juan Perez escribe por WA y luego por IG, `process_incoming_message` puede crear dos registros separados si no matchea por nombre/telefono/email. La extension `pg_trgm` de PostgreSQL permite busqueda por similitud de texto (ya disponible en Supabase). El merge debe ser cuidadoso con las FKs en cascada (WARNING: `persons` tiene dependencias en 5+ tablas). La vista unificada multi-canal es clave para que el operador vea toda la historia del lead en un solo lugar, sin importar por donde se comunico.

---

### FEAT-037 | Modulo de Newsletters / Email Marketing Centralizado

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase + Make.com + Proveedor de email (Mailchimp/Resend/SendGrid)
- **Descripcion:** Implementar un modulo centralizado de newsletters y email marketing dentro del CRM. Permitir gestionar multiples newsletters por tematica (ej: newsletter general de IITA, newsletter de programacion, newsletter de marketing digital) con frecuencia configurable (ej: mensual). El sistema debe: (1) administrar listas de suscriptores por tematica — alimentadas automaticamente desde los datos del CRM (personas con interes en X tema se agregan a la lista correspondiente), (2) crear y enviar campanas de email usando un editor integrado o conectando con un proveedor externo (Mailchimp, Resend, SendGrid), (3) gestionar opt-in/opt-out (suscripcion/desuscripcion) conforme a normas anti-spam, (4) trackear metricas (aperturas, clicks, desuscripciones, bounces), (5) programar envios automaticos (ej: primer lunes de cada mes), (6) administrar todo desde el CRM sin necesidad de ir a la interfaz del proveedor de email.
- **Dependencias:** FEAT-003 (Gestion de Personas)
- **Relacionado:** RFC-004 (Campanas de marketing — newsletters son un tipo de campana), FEAT-027 (Horarios optimos)
- **Backend requerido:**
  - Tabla `newsletters`: `(id, name, topic, description, frequency, status, subscriber_filter_criteria, template_id_external, created_at)`
  - Tabla `newsletter_editions`: `(id, newsletter_id, subject, content_html, content_text, status, scheduled_at, sent_at, total_recipients, opens, clicks, bounces, unsubscribes)`
  - Tabla `newsletter_subscriptions`: `(person_id, newsletter_id, status, subscribed_at, unsubscribed_at, source)` — status: `active`, `unsubscribed`, `bounced`
  - Campo `email_opt_in` en `persons` (global opt-in/opt-out para email marketing)
  - Integracion con proveedor de email via Make.com:
    - Sincronizar listas de suscriptores CRM → Mailchimp/SendGrid
    - Crear y enviar campanas via API del proveedor
    - Recibir webhooks de metricas (opens, clicks, bounces, unsubscribes) y actualizar DB
  - Auto-suscripcion: cuando una persona se enriquece con tag de interes "marketing", agregarla automaticamente a la newsletter de marketing (con opt-in implicito desde la conversacion)
  - Cron mensual: para cada newsletter activa con frecuencia mensual, crear edition borrador con audiencia actualizada
- **Frontend requerido:**
  - Pagina "Newsletters" con:
    - Lista de newsletters activas (general, programacion, marketing, etc.)
    - Para cada una: suscriptores, ultima edicion enviada, proxima programada
  - Crear/editar newsletter: nombre, tematica, frecuencia, criterios de audiencia (filtros de personas)
  - Crear edicion: asunto, contenido (editor basico o vinculo a Mailchimp), programar envio
  - Dashboard de metricas por edicion: abiertos, clicks, desuscripciones, bounces
  - En perfil de persona: mostrar a que newsletters esta suscripta, permitir suscribir/desuscribir
- **Notas:** Evaluar proveedores: (a) Mailchimp — gratis hasta 500 contactos, API madura, editor de email integrado, pero la interfaz es compleja; (b) Resend — moderno, barato ($0.003/email), API simple, sin editor visual; (c) SendGrid — robusto, 100 emails/dia gratis. La recomendacion es empezar con un proveedor simple (Resend o SendGrid) manejando el contenido desde el CRM, y evaluar Mailchimp si se necesita un editor visual avanzado. La frecuencia sugerida de 1/mes evita fatiga del suscriptor. Los newsletters por tematica permiten enviar contenido relevante segmentado (no todo a todos).

---

### FEAT-038 | Tracking Multi-plataforma de Campanas Publicitarias

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase + Make.com + APIs externas (Google Ads, Meta Ads, TikTok Ads)
- **Descripcion:** Vincular campanas publicitarias de multiples plataformas (Google Ads, Meta Ads, TikTok Ads) con el CRM, extrayendo costos reales diarios de cada plataforma y correlacionandolos con mensajes entrantes para medir la efectividad real de cada campana. El sistema debe: (1) conectarse a las APIs de cada plataforma para extraer metricas diarias (gasto, impresiones, clicks, CTR, CPC, conversiones), (2) relacionar leads entrantes con la campana de origen usando UTMs, `ad_id`, y parametros de tracking, (3) construir funnels de conversion completos (impresion → click → landing → contacto → respuesta → inscripcion), (4) trackear metricas de landing pages propias (visitas, bounce rate, tiempo en pagina, conversion a lead), (5) medir campanas de remarketing (audiencias personalizadas, retargeting por lista de leads), (6) generar proyecciones de inscripcion basadas en datos historicos de conversion.
- **Dependencias:** FEAT-030 (Dashboard de costos — comparten infraestructura de tracking)
- **Relacionado:** FEAT-033 (Campanas Meta Ads — FEAT-038 agrega tracking a las campanas de FEAT-033), FEAT-023 (Mapa — visualizar leads por campana de origen)
- **Backend requerido:**
  - Tabla `ad_platforms`: `(id, name, platform_type, api_credentials_encrypted, status, last_sync_at)` — plataformas conectadas (Google Ads, Meta Ads, TikTok Ads)
  - Tabla `ad_campaigns`: `(id, platform_id, external_campaign_id, name, objective, status, budget_daily, budget_total, start_date, end_date, targeting_summary, created_at)`
  - Tabla `ad_campaign_metrics`: `(id, campaign_id, date, spend, impressions, clicks, ctr, cpc, conversions, reach, frequency)` — metricas diarias por campana
  - Tabla `ad_conversions`: `(id, campaign_id, person_id, conversation_id, conversion_type, conversion_value, attributed_at)` — conversion_type: `landing_visit`, `lead_contact`, `response`, `enrollment`
  - Tabla `landing_page_stats`: `(id, page_url, campaign_id, date, visits, unique_visitors, bounce_rate, avg_time_on_page, conversions_to_lead)`
  - Enriquecer `interactions` con campo `utm_source`, `utm_medium`, `utm_campaign` para atribucion
  - Sincronizacion via Make.com: cron diario que extrae metricas de cada API y las guarda en `ad_campaign_metrics`
  - RPC `get_campaign_funnel(campaign_id)`: retorna el funnel completo con tasas de conversion en cada etapa
  - RPC `get_campaign_roi(campaign_id)`: retorna costo total, leads generados, inscripciones, ROI
  - RPC `project_enrollments(date_range, campaign_ids[])`: proyeccion de inscripciones basada en tasas historicas
- **Frontend requerido:**
  - Pagina "Campanas Publicitarias" con:
    - Dashboard general: gasto total por plataforma, leads totales por plataforma, costo por lead, ROI por campana
    - Graficos de tendencia: gasto vs leads por dia/semana/mes
    - Comparacion entre plataformas (Google vs Meta vs TikTok) en metricas clave
  - Vista de detalle por campana:
    - Metricas detalladas (impresiones, clicks, CTR, CPC, conversiones)
    - Funnel de conversion visual (barra o embudo): impresion → click → landing → lead → respuesta → inscripcion
    - Lista de leads atribuidos a esa campana
    - Timeline de gasto vs resultados
  - Seccion "Landing Pages": metricas por pagina, conversion a lead, bounce rate
  - Seccion "Remarketing": audiencias activas, costo de retargeting, tasa de re-engagement
  - Proyecciones: calculadora que dado un presupuesto y plataforma, estima leads e inscripciones esperadas
  - En perfil de persona: mostrar de que campana/plataforma llego originalmente (atribucion)
- **Notas:** La atribucion lead→campana es el desafio principal. Para leads que llegan por WA, el `ad_id` de Meta ya esta disponible en algunos flujos (BUG-006 en Roadmap). Para leads de landing pages, usar UTMs en la URL. Para TikTok y Google Ads, integrar con sus APIs de conversion. Las APIs de las tres plataformas tienen quotas y rate limits — el cron diario es suficiente (no necesita tiempo real). Las credenciales API deben almacenarse encriptadas (nunca en texto plano). Google Ads API requiere un developer token y cuenta MCC. Meta Marketing API usa tokens de pagina/app. TikTok Ads API requiere app registrada. Las proyecciones usan regresion simple sobre datos historicos — no requiere ML complejo, basta con promedios moviles de tasas de conversion.

---

### FEAT-039 | Inventario de Recursos por Curso para Conversaciones

- **Estado:** Deseado
- **Prioridad:** P2
- **Componente:** Frontend + Supabase + Make.com
- **Descripcion:** Implementar un inventario de recursos por curso (programas, videos de alumnos, videos explicativos de profesores, testimonios, PDFs, links) que los operadores puedan enviar durante conversaciones con leads. Cada recurso queda vinculado a un curso y tiene un proposito comercial especifico (informar, convencer, demostrar). El sistema trackea que recurso se envio a que lead y cuando, de manera que los operadores (y la IA) puedan: (1) saber que cartas ya se jugaron con cada lead, (2) no repetir el mismo recurso, (3) usar los recursos mas efectivos en el momento adecuado del funnel, (4) medir la efectividad de cada recurso (cuantos leads que recibieron el testimonio X terminaron inscribiendose).
- **Dependencias:** FEAT-004 (ABM de Cursos), FEAT-002 (Chat de Conversaciones)
- **Relacionado:** FEAT-029 (Composicion de mensajes — los recursos se pueden adjuntar desde ahi), FEAT-017 (Media Storage — los recursos se almacenan en Supabase Storage)
- **Backend requerido:**
  - Tabla `course_resources`: `(id, course_id, name, description, resource_type, media_url, media_type, purpose, effectiveness_score, times_sent, times_converted, sort_order, status, created_at, updated_at)`
    - `resource_type`: `program`, `student_video`, `professor_video`, `testimonial`, `pdf`, `infographic`, `link`, `other`
    - `purpose`: `inform`, `convince`, `demonstrate`, `close`, `follow_up`
    - `effectiveness_score`: calculado automaticamente como `times_converted / times_sent * 100`
  - Tabla `resource_sends`: `(id, resource_id, person_id, conversation_id, interaction_id, sent_by, sent_at, outcome)`
    - `sent_by`: `operator`, `ai`
    - `outcome`: `no_response`, `positive_response`, `negative_response`, `enrolled` — se actualiza con el tiempo
  - RPC `get_resources_for_conversation(conversation_id)`: retorna recursos del curso asociado a esa conversacion, indicando cuales ya se enviaron a ese lead y cuales no
  - RPC `get_resource_effectiveness(course_id)`: ranking de recursos por efectividad
  - Trigger que actualiza `effectiveness_score` al cambiar `outcome` en `resource_sends`
  - Enriquecer prompt de IA con informacion de recursos disponibles y enviados, para que sugiera el recurso mas relevante
- **Frontend requerido:**
  - En la pagina de Cursos (Courses.jsx) — seccion "Recursos":
    - Lista de recursos por curso con tipo, descripcion, preview de media
    - Agregar/editar/eliminar recursos: subir archivo o pegar URL, seleccionar tipo y proposito
    - Indicador de efectividad por recurso (barra de progreso o porcentaje)
    - Ordenar recursos por efectividad o por orden sugerido de uso
  - En el chat de conversaciones (Conversations.jsx):
    - Boton "Enviar recurso" en la barra de herramientas del chat
    - Panel lateral o modal con recursos disponibles del curso relevante
    - Indicador visual de cuales ya se enviaron a ese lead (tachados o con badge "ya enviado")
    - Preview del recurso antes de enviar (thumbnail de video, primera pagina de PDF, etc.)
    - Al seleccionar: el recurso se adjunta al mensaje y se crea el registro en `resource_sends`
  - Dashboard de efectividad de recursos:
    - Ranking por curso: cuales recursos generan mas conversiones
    - Heatmap: que recursos se envian mas y en que etapa del funnel
    - Sugerencia de recursos subutilizados pero efectivos
- **Notas:** Los recursos son herramientas clave de conversion. Los testimonios de alumnos y videos de profesores son los mas efectivos segun experiencia del equipo. Es importante no enviar el mismo testimonio dos veces — el tracking por lead lo previene. La IA debe conocer los recursos disponibles para poder sugerirlos en sus respuestas propuestas (ej: "Basado en que este lead pregunto sobre salida laboral, sugiero enviar el testimonio de [alumno X] que consiguio trabajo"). La tabla `resource_sends` permite analisis de efectividad a largo plazo. Los archivos pesados (videos) se almacenan en Supabase Storage (FEAT-017) y en `course_resources` solo se guarda la URL. Empezar cargando recursos de los cursos mas vendidos y expandir gradualmente.

---

### FEAT-040 | Registro de Atenciones Personales a Leads

- **Estado:** Deseado
- **Prioridad:** P1
- **Componente:** Frontend + Supabase + Make.com
- **Descripcion:** Registrar cada vez que un operador atiende personalmente a un lead (llamada telefonica, visita presencial, videollamada, mensaje directo desde telefono personal, etc.) capturando informacion minima del contacto para que quede en el sistema y se pueda hacer seguimiento. Actualmente los operadores atienden leads por fuera de los canales del CRM (llamadas personales, WhatsApp desde el telefono, visitas en la sede) y esa informacion se pierde — no queda registro en el sistema, no se sabe que se hablo, ni se puede dar continuidad. El registro debe ser rapido y facil (formulario minimo) para que los operadores lo usen en la practica.
- **Dependencias:** FEAT-003 (Gestion de Personas), FEAT-002 (Chat de Conversaciones)
- **Relacionado:** FEAT-028 (Silenciar IA — al registrar atencion personal se podria pausar la IA automaticamente), FEAT-032 (Reactivacion — no reactivar si hubo atencion personal reciente)
- **Backend requerido:**
  - Tabla `manual_contacts`: `(id, person_id, conversation_id, contact_type, contact_channel, summary, outcome, next_action, next_action_date, duration_minutes, contacted_by, contacted_at, created_at)`
    - `contact_type`: `phone_call`, `in_person_visit`, `video_call`, `personal_whatsapp`, `personal_email`, `other`
    - `contact_channel`: texto libre o referencia a canal (ej: "telefono fijo sede", "WA personal de operador X")
    - `outcome`: `interested`, `not_interested`, `needs_follow_up`, `enrolled`, `requested_info`, `no_answer`, `rescheduled`
    - `next_action`: texto libre describiendo que hacer despues (ej: "Enviar programa del curso", "Llamar el jueves")
    - `next_action_date`: fecha para agendar el seguimiento
    - `contacted_by`: operador que realizo el contacto
  - RPC `get_pending_follow_ups(operator_id)`: retorna lista de contactos manuales con `next_action_date` proximo o vencido
  - RPC `get_contact_history(person_id)`: timeline completo de contactos manuales + conversaciones automaticas
  - Trigger: al crear un `manual_contact`, opcionalmente pausar la IA para esa persona por X horas (configurable)
  - Trigger: al crear un `manual_contact`, actualizar `last_contact_at` en la persona
  - Integracion con sistema de reactivacion (FEAT-032): excluir personas con contacto manual reciente
- **Frontend requerido:**
  - Boton "Registrar contacto" accesible desde:
    - Panel de chat de una conversacion (Conversations.jsx) — boton en la barra superior
    - Perfil de persona (People.jsx) — seccion de acciones
    - Acceso rapido desde el dashboard (formulario con buscador de persona)
  - Formulario de registro rapido (modal):
    - Buscar/seleccionar persona (autocompletado por nombre, telefono o email)
    - Tipo de contacto (dropdown: llamada, visita, videollamada, WA personal, otro)
    - Canal/medio (texto libre: "telefono fijo sede centro", "WA personal de Maria")
    - Resumen de lo hablado (textarea, minimo 10 caracteres para asegurar contenido util)
    - Resultado (dropdown: interesado, no interesado, necesita seguimiento, inscripto, pidio info, no contesto, reprogramado)
    - Proxima accion (texto libre + fecha opcional): "Enviar programa" + "2026-02-25"
    - Duracion aproximada (opcional, en minutos)
  - En perfil de persona: timeline unificado que combine contactos manuales + mensajes de canales automaticos, ordenados cronologicamente
  - Dashboard de seguimientos pendientes:
    - Lista de proximas acciones con fecha, ordenadas por urgencia
    - Indicador de seguimientos vencidos (color rojo)
    - Filtro por operador, sede, estado
  - Estadisticas de contactos manuales:
    - Cantidad de contactos por operador, por dia/semana/mes
    - Distribucion por tipo de contacto y resultado
    - Tasa de conversion de contactos manuales vs automaticos
- **Notas:** La clave es que el formulario sea RAPIDO y MINIMO — si es tedioso los operadores no lo van a usar. Los campos obligatorios deben ser solo: persona, tipo de contacto, y resumen. Todo lo demas opcional pero recomendado. El campo "proxima accion" con fecha permite construir un sistema de agenda/seguimiento que hoy no existe y que es critico para no perder leads. El timeline unificado (manual + automatico) da la vision completa de la relacion con el lead. Considerar agregar notificaciones (push/email) al operador cuando un seguimiento esta proximo a vencer. Este feature complementa fuertemente a FEAT-028 (silenciar IA): si registro que atendi personalmente a un lead, el sistema puede pausar la IA automaticamente por 24-48h para evitar interferencia.

---

### FEAT-041 | Llamadas de Audio — Recibir y Generar desde el CRM

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Frontend + Supabase + Integracion VoIP/Telephony (Twilio/Vonage/Telnyx)
- **Descripcion:** Permitir que los operadores reciban y generen llamadas de audio directamente desde el CRM, como evolucion natural del sistema multicanal. Actualmente toda la comunicacion es por texto (WhatsApp, Instagram, Messenger, Email). Las llamadas de voz son un canal critico para cerrar inscripciones y resolver dudas complejas, pero hoy se hacen desde telefonos personales sin registro en el sistema. Esta feature integra telefonia (VoIP) al CRM para: (1) hacer llamadas salientes a leads desde la interfaz del CRM (click-to-call), (2) recibir llamadas entrantes y rutearlas al operador asignado, (3) grabar llamadas (con consentimiento) y almacenarlas vinculadas al lead, (4) transcribir llamadas automaticamente (speech-to-text) para que queden como texto buscable, (5) que la IA pueda analizar la transcripcion y sugerir proximos pasos post-llamada.
- **Dependencias:** FEAT-040 (Registro de contactos — las llamadas via CRM se registran automaticamente), FEAT-017 (Storage — grabaciones de audio)
- **Relacionado:** FEAT-028 (Silenciar IA — durante llamada activa la IA se pausa), FEAT-032 (Reactivacion — llamada cuenta como interaccion), FEAT-029 (Composicion IA — post-llamada la IA sugiere mensaje de seguimiento)
- **Backend requerido:**
  - Integracion con proveedor VoIP (Twilio Voice, Vonage Voice, o Telnyx):
    - Numero(s) de telefono del instituto (uno por sede o uno compartido)
    - WebRTC para llamadas desde el navegador (sin necesidad de telefono fisico)
    - Webhooks para eventos de llamada (incoming, answered, ended, recording_ready)
  - Tabla `voice_calls`: `(id, person_id, conversation_id, direction, status, phone_from, phone_to, duration_seconds, recording_url, transcription_text, transcription_status, operator_id, started_at, ended_at, cost, provider_call_id, created_at)`
    - `direction`: `inbound`, `outbound`
    - `status`: `ringing`, `in_progress`, `completed`, `missed`, `busy`, `failed`, `voicemail`
    - `transcription_status`: `pending`, `processing`, `completed`, `failed`
  - Edge Function para iniciar llamada saliente: recibe `person_id` + `operator_id`, busca telefono de la persona, inicia llamada via API de Twilio/Vonage
  - Webhook handler para llamadas entrantes: identifica persona por numero, rutea al operador asignado o al disponible
  - Transcripcion automatica post-llamada: Twilio tiene transcription integrado; alternativamente usar Whisper de OpenAI o Deepgram
  - Post-transcripcion: IA analiza contenido y genera resumen + sugiere proxima accion (reutilizar pipeline de `ai_interaction`)
  - Auto-registro en `manual_contacts` (FEAT-040) con datos de la llamada
- **Frontend requerido:**
  - Boton "Llamar" en perfil de persona y en panel de chat (click-to-call)
  - Widget de llamada en curso: panel flotante con nombre del lead, duracion, boton de colgar, mute, hold
  - Notificacion de llamada entrante: popup con datos del lead (si se identifica por numero)
  - En timeline de conversacion: las llamadas aparecen como burbujas especiales con icono de telefono, duracion, y boton para reproducir grabacion
  - Reproductor de audio inline para grabaciones
  - Transcripcion expandible debajo de cada llamada
  - Configuracion de operador: numero de extension, horario de disponibilidad, estado (disponible/ocupado/ausente)
- **Notas:** Esta es una feature de complejidad alta y costo operativo (cada minuto de llamada tiene costo con el proveedor VoIP). Se recomienda implementar en fases: (1) primero llamadas salientes click-to-call (lo mas util para cerrar ventas), (2) luego llamadas entrantes con ruteo, (3) despues grabacion + transcripcion. Twilio es el proveedor mas maduro ($0.013/min llamada + $0.05/min transcripcion). Telnyx es mas economico ($0.005/min). WebRTC permite llamar desde el navegador sin softphone. La transcripcion con IA es lo que cierra el circuito: convierte la llamada de audio en texto searchable que alimenta el contexto del lead. Requiere consentimiento para grabar — implementar aviso automatico al inicio de la llamada.
