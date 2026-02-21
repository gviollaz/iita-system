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

### FEAT-019 | Canal TikTok

- **Estado:** Deseado
- **Prioridad:** P3
- **Componente:** Make.com + Supabase
- **Descripcion:** Agregar TikTok como canal de comunicacion. Recibir y responder mensajes directos de TikTok a traves del pipeline multicanal existente.
- **Dependencias:** FEAT-005 (Pipeline Multicanal)
- **Notas:** Requiere evaluar disponibilidad de TikTok Messaging API y webhooks.

---

### FEAT-020 | Canal Discord

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
