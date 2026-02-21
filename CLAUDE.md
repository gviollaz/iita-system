# IITA CRM System

Sistema CRM multicanal para IITA (Instituto de Innovacion y Tecnologia Aplicada), Salta, Argentina.
Gestiona conversaciones por WhatsApp, Instagram, Messenger y Email con respuestas de IA.

## Quick Reference

- **Supabase Project ID:** `cpkzzzwncpbzexpesock`
- **Region:** us-east-1
- **API URL:** https://cpkzzzwncpbzexpesock.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/cpkzzzwncpbzexpesock
- **Frontend:** React 19 + Vite 6 (en `apps/crm-frontend/`)
- **Make.com:** Escenarios activos (en `automations/make-scenarios/`)
- **Owner:** gviollaz

## Arquitectura

```
Canales (WA/IG/Messenger/Email) → Make.com (webhooks) → Supabase (PostgreSQL + Edge Functions) ← React Frontend (CRM)
```

### Flujo de un mensaje entrante
1. Persona envia mensaje por WhatsApp/Instagram/etc.
2. Make.com recibe via webhook y llama RPC `process_incoming_message`
3. Supabase crea persona/conversacion/interaccion en una transaccion atomica
4. Triggers notifican a Make.com para preprocesar media y generar respuesta IA
5. Respuesta IA se guarda en `ai_interaction` con `evaluation = pending`
6. Operador aprueba/rechaza desde el CRM frontend
7. Make.com envia la respuesta por el canal original

### Direccion de mensajes en `interactions`
- **Entrante** (persona → sistema): `id_person_conversation IS NOT NULL`, `id_system_conversation IS NULL`
- **Saliente** (sistema → persona): `id_person_conversation IS NULL`, `id_system_conversation IS NOT NULL`
- Constraint `chk_single_direction` lo garantiza

## Estructura del repo

```
iita-system/
├── CLAUDE.md                    # Este archivo (contexto para Claude Code)
├── AGENTS.md                    # Contexto universal para cualquier IA
├── CONTRIBUTING.md              # Reglas de contribucion y nomenclatura
├── CHANGELOG.md                 # Historial de cambios
├── README.md                    # Indice maestro de documentacion
├── apps/crm-frontend/           # Frontend React (git subtree desde IITA-Proyectos/iitacrm)
├── automations/make-scenarios/  # Escenarios Make.com (git subtree desde gviollaz/iita-make-scenarios)
├── database/
│   ├── schema/
│   │   ├── functions/           # 24 funciones RPC (.sql)
│   │   ├── triggers/            # all_triggers.sql
│   │   └── enums/               # all_enums.sql
│   └── edge-functions/          # Codigo fuente de Edge Functions (Deno/TypeScript)
│       ├── crm-api/             # API principal del CRM (v19)
│       ├── courses-crud/        # CRUD de cursos (v1)
│       └── create-test-user/    # Crear usuario de prueba (v2)
├── proposals/
│   ├── features/                # RFCs de mejoras grandes
│   └── changes/                 # Propuestas de cambio puntuales (de IAs con acceso limitado)
├── scripts/
│   ├── setup-subtrees.sh        # Configurar subtrees
│   └── sync-subtrees.sh         # Sincronizar subtrees
└── docs/
    ├── architecture/            # Vision general, flujo de mensajes
    ├── database/                # Diccionario de datos, ERD
    ├── bugs/                    # Bugs conocidos y resueltos
    ├── features/                # Features y roadmap
    ├── proposals/               # Propuestas no implementadas
    ├── operations/              # Migraciones, operaciones de datos, rollbacks
    ├── policies/                # Nomenclatura, comentarios, IA, filosofia
    └── make-pipeline/           # Pipeline Make.com
```

## Warnings criticos

- **NO habilitar JWT** en Edge Functions sin implementar login en el frontend primero
- **NO modificar** triggers de `interactions` sin entender el pipeline de Make.com
- **NO hacer DELETE** en `persons` o `interactions` — tienen dependencias en cascada (FKs en 5+ tablas)
- **NO cambiar** esquema de `person_soft_data` — Make.com inserta ahi continuamente
- **NO asumir** que `status` de interacciones es texto libre — es enum estricto
- Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` (acceso total)
- El bucket `media` de Storage es publico

## Comandos

### Frontend
```bash
cd apps/crm-frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # Build produccion
npm run preview    # Preview del build
```

### Sincronizacion con repos originales (git subtree)
```bash
git subtree pull --prefix=apps/crm-frontend https://github.com/IITA-Proyectos/iitacrm.git main
git subtree pull --prefix=automations/make-scenarios https://github.com/gviollaz/iita-make-scenarios.git main
```

## Frontend (`apps/crm-frontend/`)

React 19 + Vite 6. Sin TypeScript, sin ESLint, sin tests.

### Paginas
| Archivo | Ruta | Descripcion |
|---------|------|-------------|
| `Dashboard.jsx` | `/` | KPIs, graficos, estadisticas |
| `Conversations.jsx` | `/conversations` | Lista y detalle de conversaciones con chat |
| `People.jsx` | `/people` | Tabla de personas/leads con filtros |
| `Courses.jsx` | `/courses` | Gestion de cursos y ediciones |
| `Health.jsx` | `/health` | Estado del sistema |

### Componentes
- `GenericTable.jsx` — Tabla reutilizable con paginacion, filtros, sorting
- `Charts.jsx` — Graficos (barras, lineas, pie)
- `Lightbox.jsx` — Visor de imagenes/media
- `ui.jsx` — Componentes base (Badge, etc.)

### Lib
- `api.js` — Cliente Supabase, llamadas a RPCs y Edge Functions
- `useIsMobile.js` — Hook para detectar mobile
- `utils.js` — Utilidades generales

### Convenciones
- Path alias: `@/` = `src/` (configurado en `vite.config.js`)
- Componentes: PascalCase
- Hooks: `use{Desc}`
- CSS vars: `--kebab-case`

## Base de datos (PostgreSQL 17 via Supabase)

### Tablas principales
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

### Funciones RPC clave
| Funcion | Descripcion |
|---------|-------------|
| `process_incoming_message` | Transaccion atomica: crea persona+conversacion+interaccion |
| `process_outgoing_message` | Registra mensaje saliente |
| `process_echo_message` | Procesa mensaje eco (dedup) |
| `get_conversations` | Lista conversaciones con CTEs optimizados |
| `get_chat_detail` | Detalle de chat (reemplaza 7 queries) |
| `get_person_detail` / `get_person_full_profile` | Perfil de persona |
| `get_persons_enriched` | Lista personas con datos enriquecidos |
| `search_persons` | Busqueda full-text (tsvector) |
| `approve_ai_response` / `reject_ai_response` | Evaluar respuesta IA (idempotente, deadline 24h) |
| `get_crm_stats` | Estadisticas generales del CRM |
| `get_msgs_per_day` / `get_volume_by_channel` | Analytics de volumen |
| `prevent_echo_interaction` | Trigger: previene duplicados eco |

### Ciclos de estado
- **Interacciones:** `new` → `preprocessed` → `processed` → `pending_delivery` → `sending` → `send`
- **Evaluacion IA:** `pending` → `approved` | `confictive`
- **Ediciones curso:** `Enrolling` → `Pending` → `In_Progress` → `Conclude` → `Disabled`

### Convenciones de nomenclatura
| Objeto | Convencion | Ejemplo |
|--------|-----------|---------|
| Tablas | snake_case, plural | `interactions`, `course_editions` |
| Columnas | snake_case | `first_name`, `time_stamp` |
| PK | `id` (serial) | `id` |
| FK | `{tabla_singular}_id` | `person_id`, `channel_id` |
| Indices | `idx_{tabla}_{columnas}` | `idx_interactions_status` |
| Triggers | `trg_{accion}_{desc}` | `trg_prevent_echo_interaction` |
| Funciones | `{verbo}_{sustantivo}` | `get_conversations` |
| Enums | `{contexto}_{campo}` | `interaction_status` |

### Desvios historicos (no renombrar sin migracion)
- `id_person_conversation` → deberia ser `person_conversation_id`
- `id_system_conversation` → deberia ser `system_conversation_id`
- `channels.descrption` → typo (deberia ser `description`)
- `ai_interaction` → singular (deberia ser `ai_interactions`)
- `confictive` → typo en enum (deberia ser `conflictive`)

## Edge Functions (Deno/TypeScript)

Deployadas en Supabase. Usan `SUPABASE_SERVICE_ROLE_KEY` (no JWT).

| Funcion | Ubicacion | Descripcion |
|---------|-----------|-------------|
| `crm-api` | `database/edge-functions/crm-api/index.ts` | API principal: routing de endpoints del CRM |
| `courses-crud` | `database/edge-functions/courses-crud/index.ts` | CRUD de cursos y ediciones |
| `create-test-user` | `database/edge-functions/create-test-user/index.ts` | Crear usuario de prueba |

## Formato de commits

Conventional Commits con trailers de IA obligatorios:

```
<tipo>: <descripcion breve>

[cuerpo opcional]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: gviollaz
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `migration`, `data`

## Checklist post-cambios

Despues de hacer cambios, actualizar la documentacion correspondiente:

- [ ] `CHANGELOG.md` — siempre
- [ ] `docs/database/data-dictionary.md` — si se modifico la DB
- [ ] `docs/operations/MIGRATIONS-LOG.md` — si se aplico migracion
- [ ] `docs/operations/DATA-OPERATIONS.md` — si se hizo operacion de datos (incluir query de rollback)
- [ ] `docs/bugs/BUGS-CONOCIDOS.md` — si se resolvio o descubrio un bug
- [ ] `docs/features/FEATURES.md` — si se implemento un feature

## Propuestas de cambio

Claude Code tiene acceso a todos los repos del proyecto. Puede:
1. Ejecutar propuestas pendientes en `proposals/changes/` creadas por otras IAs
2. Mover propuestas ejecutadas a `proposals/changes/archive/`
3. Revisar y contribuir a RFCs en `proposals/features/`

Ver indice de RFCs activos: `proposals/features/INDEX.md`

## Documentacion clave

| Necesitas... | Ve a... |
|-------------|---------|
| Arquitectura completa | `docs/architecture/system-overview.md` |
| Flujo de mensajes | `docs/architecture/message-flow.md` |
| Estructura de tablas | `docs/database/data-dictionary.md` |
| Relaciones (ERD) | `docs/database/erd.md` |
| Bugs conocidos | `docs/bugs/BUGS-CONOCIDOS.md` |
| Features y roadmap | `docs/features/FEATURES.md` y `ROADMAP.md` |
| Propuestas pendientes | `docs/proposals/PROPUESTAS-PENDIENTES.md` |
| RFCs de mejora | `proposals/features/INDEX.md` |
| Migraciones | `docs/operations/MIGRATIONS-LOG.md` |
| Rollbacks | `docs/operations/ROLLBACK-PROCEDURES.md` |
| Convenciones de nombres | `docs/policies/NAMING-CONVENTIONS.md` |
| Politica de IA | `docs/policies/AI-COLLABORATION.md` |
| Pipeline Make.com | `docs/make-pipeline/pipeline-overview.md` |
| Contexto para todas las IAs | `AGENTS.md` |
| Reglas de contribucion | `CONTRIBUTING.md` |
