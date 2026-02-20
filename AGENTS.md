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

## Repositorios del proyecto

El sistema IITA esta distribuido en 3 repositorios. `iita-system` es el hub central de documentacion y referencia:

| Repositorio | Contenido | Quien lo modifica |
|-------------|-----------|-------------------|
| **`gviollaz/iita-system`** | Documentacion, schema SQL, Edge Functions, propuestas | Todas las IAs + humanos |
| **`IITA-Proyectos/iitacrm`** | Codigo React del frontend CRM | Claude Code (acceso directo) + otras IAs via propuestas |
| **`gviollaz/iita-make-scenarios`** | Escenarios JSON de Make.com | Claude Code (acceso directo) + otras IAs via propuestas |

### Donde van los cambios segun el tipo

| Tipo de cambio | Repo destino | Ejemplo |
|---|---|---|
| Documentacion, analisis, propuestas | `iita-system` | Actualizar ERD, agregar bug, nueva propuesta |
| Schema SQL (funciones, triggers, migraciones) | `iita-system` (docs) + Supabase (deploy) | Nueva funcion RPC |
| Codigo React del CRM | `iitacrm` | Fix componente, nueva pagina |
| Escenarios Make.com | `iita-make-scenarios` | Fix blueprint JSON |
| Edge Functions | `iita-system` (docs) + Supabase (deploy) | Nueva version de crm-api |

### Si solo tenes acceso a `iita-system`

**Muchas IAs (ChatGPT, Gemini, Copilot) solo pueden ver un repositorio a la vez.** Si ese es tu caso:

1. **Podes leer** toda la documentacion, esquema de DB, Edge Functions y propuestas.
2. **Podes modificar** documentacion directamente (bugs, features, changelog, etc.).
3. **Para cambios de codigo** (React, Make.com, SQL) que no podes ejecutar directamente: **crea una propuesta de cambio** en `proposals/changes/`. Ver seccion siguiente.

## Como proponer cambios (para IAs con acceso limitado)

Si no podes modificar directamente el repo destino (`iitacrm` o `iita-make-scenarios`), o no podes ejecutar migraciones SQL en Supabase, crea un archivo de propuesta en `proposals/changes/`:

### Formato del archivo

Nombre: `proposals/changes/YYYY-MM-DD-descripcion-corta.md`

Ejemplo: `proposals/changes/2026-02-21-fix-dashboard-kpi-calculo.md`

```markdown
# Propuesta de cambio: [titulo descriptivo]

- **Fecha:** YYYY-MM-DD
- **Autor IA:** [tu nombre + modelo] (ej: ChatGPT gpt-4o, Gemini 2.0, etc.)
- **Repo destino:** [iitacrm | iita-make-scenarios | supabase-migration]
- **Prioridad sugerida:** [P0 | P1 | P2 | P3]
- **Estado:** pendiente

## Problema

[Descripcion del problema que resuelve]

## Solucion propuesta

[Descripcion de la solucion]

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Dashboard.jsx` | Corregir calculo de KPI X en linea ~45 |

## Codigo propuesto

[Incluir el codigo completo que se debe insertar/reemplazar, con contexto suficiente
para identificar DONDE va el cambio]

## Como verificar

[Pasos para verificar que el cambio funciona]

## Rollback

[Como revertir si algo sale mal]
```

### Reglas para propuestas

1. **Un archivo por cambio.** No mezclar multiples cambios no relacionados.
2. **Incluir codigo completo.** No "pseudocodigo" ni "algo asi como...". Codigo real, listo para copiar y aplicar.
3. **Incluir contexto de ubicacion.** Indicar archivo, linea aproximada, funcion o componente donde va el cambio.
4. **Identificarte siempre.** El campo "Autor IA" es obligatorio. Incluir modelo usado.
5. **No marcar como aprobado.** Solo un humano (gviollaz) o Claude Code pueden aprobar y ejecutar propuestas.

### Ciclo de vida de una propuesta

```
pendiente → en_revision → aprobada → ejecutada
                        → rechazada (con motivo)
                        → modificada (se pide ajuste a la IA autora)
```

Las propuestas aprobadas se ejecutan desde Claude Code (que tiene acceso a todos los repos) o manualmente por gviollaz. Una vez ejecutada, se mueve a `proposals/changes/archive/` con el resultado.

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
| Propuestas de cambio de codigo | `proposals/changes/` |
| Migraciones | `docs/operations/MIGRATIONS-LOG.md` |
| Operaciones de datos | `docs/operations/DATA-OPERATIONS.md` |
| Rollbacks | `docs/operations/ROLLBACK-PROCEDURES.md` |
| Convenciones de nombres | `docs/policies/NAMING-CONVENTIONS.md` |
| Como trabajar con IAs | `docs/policies/AI-COLLABORATION.md` |
| Historial de cambios | `CHANGELOG.md` |

## Atribucion de cambios

**Obligatorio:** Toda IA debe identificarse en cada cambio que haga, ya sea un commit, una propuesta, o una actualizacion de documentacion.

Formato para commits:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: gviollaz
```

Formato para documentacion y propuestas:
```
**Autor IA:** [Nombre] [Modelo] (ej: ChatGPT gpt-4o)
**Fecha:** YYYY-MM-DD
**Revisado por:** [humano que reviso, si aplica]
```

**Esto es obligatorio para TODAS las IAs.** La razon: necesitamos saber de donde viene cada dato, cada analisis y cada cambio para poder evaluar la calidad y trazabilidad de las contribuciones.

Ver politica completa: `docs/policies/AI-COLLABORATION.md`
