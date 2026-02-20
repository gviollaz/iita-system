# IITA CRM System — Contexto para IAs

> Este archivo proporciona contexto para cualquier IA que trabaje en este proyecto.
> Leelo completo antes de hacer cambios. Si sos ChatGPT, Gemini, Copilot, Claude u otra IA: este es tu punto de partida.

## Que es este proyecto

Sistema CRM multicanal para el **Instituto de Innovacion y Tecnologia Aplicada (IITA)** en Salta, Argentina. Gestiona comunicaciones con alumnos y leads a traves de WhatsApp, Instagram, Messenger y Email.

## Arquitectura

```
Canales (WA/IG/Messenger/Email) → Make.com (webhooks) → Supabase (PostgreSQL + Edge Functions) ← React Frontend (CRM)
```

### Flujo de un mensaje
1. Persona envia mensaje por WhatsApp/Instagram/etc.
2. Make.com lo recibe via webhook
3. Crea persona/conversacion/interaccion en Supabase (RPC `process_incoming_message`)
4. Triggers notifican a Make.com para preprocesar media y generar respuesta IA
5. Respuesta IA se guarda en `ai_interaction` con evaluation = `pending`
6. Operador la aprueba/rechaza desde el CRM frontend
7. Make.com envia la respuesta por el canal original

## Stack tecnologico

| Componente | Tecnologia | Ubicacion |
|------------|-----------|-----------|
| Frontend | React 19 + Vite 6 | `apps/crm-frontend/` |
| Base de datos | PostgreSQL 17 (Supabase) | `database/schema/` |
| API | Edge Functions (Deno) | `database/edge-functions/` |
| Automatizaciones | Make.com (117 escenarios) | `automations/make-scenarios/` |
| IA | OpenAI GPT + Claude | Configurado en Make.com |

## Tablas principales

| Tabla | ~Filas | Descripcion |
|-------|--------|-------------|
| `persons` | 25K | Personas/leads/alumnos |
| `interactions` | 102K | Mensajes individuales (entrantes y salientes) |
| `person_soft_data` | 75K | Datos enriquecidos key-value por persona |
| `conversations` | 24K | Hilos de conversacion |
| `person_conversation` | 24K | Vincula persona ↔ conversacion (incluye address) |
| `system_conversation` | 24K | Vincula conversacion ↔ canal |
| `ai_interaction` | 12K | Respuestas generadas por IA |
| `channels` | 11 | Canales de comunicacion |
| `courses` | 40 | Catalogo de cursos |
| `course_editions` | 98 | Ediciones/cohortes |

Ver diccionario completo: `docs/database/data-dictionary.md`

## Direccion de mensajes

- **Entrante** (persona → sistema): `id_person_conversation IS NOT NULL`, `id_system_conversation IS NULL`
- **Saliente** (sistema → persona): `id_person_conversation IS NULL`, `id_system_conversation IS NOT NULL`
- Constraint `chk_single_direction` lo garantiza

## Ciclos de estado

- **Interacciones:** `new` → `preprocessed` → `processed` → `pending_delivery` → `sending` → `send`
- **Evaluacion IA:** `pending` → `approved` | `confictive`
- **Ediciones curso:** `Enrolling` → `Pending` → `In_Progress` → `Conclude` → `Disabled`

## Lo que NO hacer

1. **NO habilitar JWT** en Edge Functions sin login en frontend
2. **NO modificar** triggers de `interactions` — disparan webhooks a Make.com
3. **NO hacer DELETE** en `persons` — FKs en cascada en 5+ tablas
4. **NO cambiar** esquema de `person_soft_data` — Make.com inserta ahi continuamente
5. **NO asumir** que `status` de interacciones es texto libre — es enum estricto

## Supabase

- **Project ID:** `cpkzzzwncpbzexpesock`
- **Region:** us-east-1
- **API URL:** https://cpkzzzwncpbzexpesock.supabase.co
- **Storage:** Bucket `media` (publico)

## Donde encontrar cada cosa

| Necesitas... | Ve a... |
|-------------|---------|
| Arquitectura | `docs/architecture/system-overview.md` |
| Estructura de tablas | `docs/database/data-dictionary.md` |
| Relaciones entre tablas | `docs/database/erd.md` |
| Funciones SQL | `database/schema/functions/` |
| Edge Functions | `database/edge-functions/` |
| Bugs conocidos | `docs/bugs/BUGS-CONOCIDOS.md` |
| Features y roadmap | `docs/features/FEATURES.md` y `ROADMAP.md` |
| Propuestas pendientes | `docs/proposals/PROPUESTAS-PENDIENTES.md` |
| Migraciones | `docs/operations/MIGRATIONS-LOG.md` |
| Operaciones de datos | `docs/operations/DATA-OPERATIONS.md` |
| Rollbacks | `docs/operations/ROLLBACK-PROCEDURES.md` |
| Convenciones de nombres | `docs/policies/NAMING-CONVENTIONS.md` |
| Como trabajar con IAs | `docs/policies/AI-COLLABORATION.md` |
| Historial de cambios | `CHANGELOG.md` |

## Atribucion de cambios

Cada commit con participacion de IA debe incluir:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: gviollaz
```
Ver politica completa: `docs/policies/AI-COLLABORATION.md`
