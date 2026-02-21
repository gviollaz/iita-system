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

## Fase 2 - Bugs P0 en Make.com

**Objetivo:** Corregir perdida de datos activa en los flujos de entrada.

| # | Tarea | Escenario | Prioridad | Ref |
|---|-------|-----------|-----------|-----|
| 2.1 | Fix caption WA Cloud API | 4097069, mod 8 | P0 | BUG-001 |
| 2.2 | Fix media ID WA Coexistence | 4161348, mod 6 | P0 | BUG-002 |
| 2.3 | Fix video.id por video.caption en WA Coexistence | 4161348, mod 7 | P0 | BUG-003 |
| 2.4 | Desactivar escenario media analysis (apunta a DB dev) | 4105815 | P0 | BUG-004 |

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
| 3.5 | Agregar status "new" en flujo WA Coexistence | Make.com | P1 | BUG-007 |
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

---

## Fase 7 - Separacion de Ambientes

**Objetivo:** Dev y produccion completamente aislados.

| # | Tarea | Componente | Prioridad | Ref |
|---|-------|------------|-----------|-----|
| 7.1 | Crear proyecto Supabase de desarrollo | Supabase | P2 | - |
| 7.2 | Configurar variables de entorno por ambiente | Frontend | P2 | - |
| 7.3 | Duplicar escenarios Make.com para dev | Make.com | P2 | - |
| 7.4 | Documentar proceso de deploy dev -> staging -> produccion | Docs | P3 | - |
