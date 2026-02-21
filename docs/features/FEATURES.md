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
