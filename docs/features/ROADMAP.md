# Roadmap del Sistema

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Resumen de Prioridades

| Prioridad | Descripcion | Fases |
|-----------|-------------|-------|
| P0 | Critico - Seguridad y perdida de datos activa | Fase 1, Fase 2 |
| P1 | Alto - Consolidacion y datos completos | Fase 3, Fase 4, Fase 5 |
| P2 | Medio - Funcionalidades nuevas y optimizacion | Fase 4, Fase 5, Fase 6 |
| P3 | Bajo - Mejoras futuras | Fase 6, Fase 7 |

---

## Fase 1 - Seguridad Critica

**Objetivo:** Cerrar los vectores de acceso no autorizado a 25K+ registros personales.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 1.1 | Implementar login en el CRM con Supabase Auth | Frontend | P0 | FEAT-010 |
| 1.2 | Habilitar JWT en Edge Functions (`verify_jwt: true`) | Supabase EF | P0 | BUG-011 |
| 1.3 | Agregar whitelist de tablas en CRUD generico de crm-api | Supabase EF | P0 | - |
| 1.4 | Restringir CORS a dominios conocidos (reemplazar `*`) | Supabase EF | P0 | - |
| 1.5 | ~~Fijar `search_path` en las 15 funciones PostgreSQL~~ *(Completado en repo - Gemini 3)* | Supabase DB | P1 | BUG-R004 |
| 1.6 | Reemplazar politicas RLS `USING(true)` por condiciones reales | Supabase DB | P1 | BUG-010 |
| 1.7 | Habilitar Leaked Password Protection en Auth | Supabase Auth | P2 | - |

**Dependencias:** 1.1 debe completarse antes de 1.2. Si se habilita JWT sin login, el CRM deja de funcionar.

---

## Fase 2 - Bugs P0 en Make.com (Completada)

**Objetivo:** Corregir perdida de datos activa en los flujos de entrada. *(Auditoria Gemini 3: Tareas completadas en repositorio)*

| # | Tarea | Escenario | Prioridad | Ref |
|---|-------|-----------|-----------|-----|
| 2.1 | ~~Fix caption WA Cloud API~~ *(Validado en repo - Gemini 3)* | 4097069, mod 8 | P0 | BUG-R005 |
| 2.2 | ~~Fix media ID WA Coexistence~~ *(Validado en repo - Gemini 3)* | 4161348, mod 6 | P0 | BUG-R006 |
| 2.3 | ~~Fix video.id por video.caption en WA Coexistence~~ *(Validado en repo - Gemini 3)* | 4161348, mod 7 | P0 | BUG-R007 |
| 2.4 | ~~Desactivar escenario media analysis (apunta a DB dev)~~ *(Falso positivo: se usa 4132732)* | 4105815 | P0 | BUG-R008 |

**Proceso:** Usar `make_sync.py prepare-fix` -> editar JSONs -> `make_sync.py diff` -> `make_sync.py import`

---

## Fase 3 - Consolidar Aprobacion y Datos Faltantes

**Objetivo:** Un solo flujo de aprobacion y datos completos por mensaje.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 3.1 | Deprecar flujo Google Sheets (desactivar esc 3502129) | Make.com | P1 | - |
| 3.2 | Verificar aprobacion CRM -> webhook Make.com end-to-end | CRM + Make | P1 | - |
| 3.3 | Agregar person_name al flujo Instagram | Make.com | P1 | BUG-005 |
| 3.4 | Agregar ad_id a todos los flujos de entrada | Make.com | P1 | BUG-006 |
| 3.5 | ~~Agregar status "new" en flujo WA Coexistence~~ *(Falso positivo - Gemini 3)* | Make.com | P1 | BUG-R009 |
| 3.6 | Fix echo text hardcoded | Make.com | P1 | BUG-008 |

---

## Fase 4 - RBAC y Autenticacion Completa

**Objetivo:** Control de acceso por usuario y sede.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 4.1 | Popular tablas roles y permissions (admin, operador, viewer) | Supabase DB | P1 | FEAT-011 |
| 4.2 | Crear flujo asignacion usuario a sede (branche_users) | Frontend + DB | P2 | FEAT-011 |
| 4.3 | Filtrar datos en CRM segun sede del usuario logueado | Frontend + EF | P2 | FEAT-011 |
| 4.4 | Actualizar politicas RLS con auth.uid() + rol + sede | Supabase DB | P2 | BUG-010 |
| 4.5 | Agregar middleware de autorizacion en crm-api | Supabase EF | P2 | - |

**Dependencias:** Requiere Fase 1 completada (login funcional).

---

## Fase 5 - Storage y Performance

**Objetivo:** Reducir consumo de DB y mejorar tiempos de respuesta.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 5.1 | Migrar media de base64 a Supabase Storage (URLs) | Make.com + DB | P1 | FEAT-017 |
| 5.2 | Migracion de datos existentes (base64 a Storage URL) | Script + DB | P2 | FEAT-017 |
| 5.3 | Eliminar 15 indices sin usar | Supabase DB | P2 | - |
| 5.4 | Cambiar Auth de conexiones absolutas a porcentaje | Supabase Auth | P2 | - |
| 5.5 | Revisar queries N+1 en crm-api | Supabase EF | P2 | - |

---

## Fase 6 - Funcionalidades Nuevas

**Objetivo:** Completar modulos disenados pero no implementados.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 6.1 | Implementar modulo de pagos | Frontend + DB | P2 | FEAT-012 |
| 6.2 | Implementar inscripcion de alumnos | Frontend + DB | P2 | FEAT-013 |
| 6.3 | Implementar evaluacion automatica IA | Make.com + CRM | P2 | FEAT-014 |
| 6.4 | Implementar auto-cancel IA por respuesta humana | Make.com + DB | P2 | FEAT-015 |
| 6.5 | Sesiones virtuales | Make.com + DB | P3 | FEAT-016 |
| 6.6 | Limpieza de 74 escenarios inactivos en Make.com | Make.com | P3 | - |
| 6.7 | Control de ventanas de tiempo por canal + alertas + estadisticas de vencimiento | Frontend + DB + Make.com | P1 | FEAT-025, RFC-005 |
| 6.8 | Silenciar IA por persona — modo "canal manual" desde flujo de aprobacion | Frontend + DB + Make.com | P1 | FEAT-028, RFC-003 |
| 6.9 | Composicion de mensajes con asistente IA on-demand + adjuntos | Frontend + EF + Make.com | P1 | FEAT-029 |
| 6.10 | Reactivacion automatica de conversaciones sin respuesta (cron + IA) | Make.com + DB + Frontend | P1 | FEAT-032 |

---

## Fase 8 - Nuevos Canales de Comunicacion

**Objetivo:** Ampliar el alcance multicanal con nuevas plataformas.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 8.1 | Integrar canal TikTok (mensajes directos) | Make.com + DB | P3 | FEAT-019 |
| 8.2 | Integrar canal Discord (bot + mensajes directos) | Make.com + DB | P3 | FEAT-020 |
| 8.3 | Integrar canal Sitio Web (widget de chat embebible) | Make.com + DB + Frontend | P3 | FEAT-021 |
| 8.4 | Integrar canal YouTube (mensajes directos) | Make.com + DB | P3 | FEAT-022 |
| 8.5 | Vista de mapa para leads y clientes | Frontend + DB | P3 | FEAT-023 |
| 8.6 | Rate limiting y control de consumo de IA | Make.com + DB | P2 | FEAT-024 |
| 8.7 | Mensajeria alternativa fuera de ventana (terceros, fallback SMS/email) | Make.com + DB + Integraciones | P2 | FEAT-026 |
| 8.8 | Optimizacion inteligente de horarios de envio | Make.com + DB + Frontend | P2 | FEAT-027 |
| 8.9 | Dashboard de costos operativos (IA, Make.com, canales, storage) | Frontend + DB + Make.com | P2 | FEAT-030 |
| 8.10 | Banco de respuestas pre-generadas para leads nuevos | Make.com + DB + Frontend | P2 | FEAT-031 |
| 8.11 | Campanas de marketing pago en Meta (Ads automatizados por calendario) | Make.com + DB + Frontend + Meta API | P2 | FEAT-033 |
| 8.12 | Enriquecimiento de datos desde fuentes externas (LinkedIn, APIs, web) | Make.com + DB + Scripts | P2 | FEAT-034 |
| 8.13 | Importacion de datos desde Moodle y archivos CSV/Excel | Make.com + DB + Frontend + Scripts | P1 | FEAT-035 |
| 8.14 | Deteccion de leads duplicados y unificacion multi-canal | Frontend + DB + Scripts | P1 | FEAT-036 |

**Notas:** Cada canal nuevo requiere: crear registro en tabla `channels`, escenario de entrada en Make.com, mapeo de webhooks, y prueba end-to-end del pipeline. La importacion de Moodle (FEAT-035) es P1 porque hay alumnos existentes que deben estar en el CRM. El enriquecimiento externo (FEAT-034) empieza con APIs por email y luego avanza a LinkedIn. El rate limiting de IA (FEAT-024) y el dashboard de costos (FEAT-030) comparten tabla de tracking. La mensajeria alternativa (FEAT-026) tiene riesgos de TOS — empezar con fallbacks oficiales (email/SMS). El banco de respuestas (FEAT-031) reduce costos de IA para leads nuevos.

---

## Fase 7 - Separacion de Ambientes

**Objetivo:** Dev y produccion completamente aislados.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 7.1 | Crear proyecto Supabase de desarrollo | Supabase | P2 | - |
| 7.2 | Configurar variables de entorno por ambiente | Frontend | P2 | - |
| 7.3 | Duplicar escenarios Make.com para dev | Make.com | P2 | - |
| 7.4 | Documentar proceso de deploy dev -> staging -> produccion | Docs | P3 | - |
