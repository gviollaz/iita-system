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
