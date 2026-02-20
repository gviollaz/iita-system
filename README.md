# IITA CRM System

> Repositorio unificado del sistema CRM multicanal del Instituto de Innovacion y Tecnologia Aplicada (IITA), Salta, Argentina.

## Que es este sistema

CRM que gestiona comunicaciones con alumnos y leads a traves de WhatsApp, Instagram, Messenger y Email. Incluye generacion de respuestas por IA y un dashboard de gestion.

## Indice maestro de documentacion

### Para empezar
| Archivo | Descripcion |
|---------|-------------|
| [CLAUDE.md](CLAUDE.md) | Contexto rapido para Claude Code |
| [AGENTS.md](AGENTS.md) | Contexto universal para cualquier IA (ChatGPT, Gemini, Copilot, etc.) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Reglas de contribucion, nomenclatura, formato de commits |

### Arquitectura y diseno
| Archivo | Descripcion |
|---------|-------------|
| [docs/architecture/system-overview.md](docs/architecture/system-overview.md) | Vision general del sistema, diagrama de arquitectura |
| [docs/architecture/message-flow.md](docs/architecture/message-flow.md) | Flujo completo de un mensaje entrante/saliente |

### Base de datos
| Archivo | Descripcion |
|---------|-------------|
| [docs/database/data-dictionary.md](docs/database/data-dictionary.md) | Diccionario de datos completo (tablas, campos, tipos, descripciones) |
| [docs/database/erd.md](docs/database/erd.md) | Diagramas entidad-relacion (Mermaid) |
| [database/schema/](database/schema/) | DDL completo: tables, functions, triggers, enums |
| [database/edge-functions/](database/edge-functions/) | Codigo fuente de Edge Functions |

### Gestion del proyecto
| Archivo | Descripcion |
|---------|-------------|
| [docs/bugs/BUGS-CONOCIDOS.md](docs/bugs/BUGS-CONOCIDOS.md) | Bugs detectados, resueltos, y con propuesta pendiente |
| [docs/features/FEATURES.md](docs/features/FEATURES.md) | Features implementados, en progreso y planificados |
| [docs/features/ROADMAP.md](docs/features/ROADMAP.md) | Prioridades y plan de trabajo por fases |
| [docs/proposals/PROPUESTAS-PENDIENTES.md](docs/proposals/PROPUESTAS-PENDIENTES.md) | Mejoras propuestas pero no implementadas |
| [proposals/features/INDEX.md](proposals/features/INDEX.md) | Propuestas de mejora (RFCs) — ideas grandes, colaborativas |
| [proposals/features/TEMPLATE.md](proposals/features/TEMPLATE.md) | Template para nuevas propuestas de mejora |
| [proposals/changes/](proposals/changes/) | Propuestas de cambio de codigo (creadas por IAs con acceso limitado) |
| [proposals/changes/TEMPLATE.md](proposals/changes/TEMPLATE.md) | Template para propuestas de cambio de codigo |

### Operaciones y datos
| Archivo | Descripcion |
|---------|-------------|
| [docs/operations/MIGRATIONS-LOG.md](docs/operations/MIGRATIONS-LOG.md) | Historial de migraciones SQL aplicadas con rollback |
| [docs/operations/DATA-OPERATIONS.md](docs/operations/DATA-OPERATIONS.md) | Operaciones masivas sobre datos (enriquecimiento, limpieza) |
| [docs/operations/ROLLBACK-PROCEDURES.md](docs/operations/ROLLBACK-PROCEDURES.md) | Procedimientos de rollback para cada operacion |

### Politicas y convenciones
| Archivo | Descripcion |
|---------|-------------|
| [docs/policies/NAMING-CONVENTIONS.md](docs/policies/NAMING-CONVENTIONS.md) | Nomenclatura de tablas, campos, variables, archivos |
| [docs/policies/CODE-COMMENTS.md](docs/policies/CODE-COMMENTS.md) | Politica de comentarios en codigo y documentacion |
| [docs/policies/AI-COLLABORATION.md](docs/policies/AI-COLLABORATION.md) | Como trabajar con IAs, atribucion, trazabilidad |
| [docs/policies/REPOSITORY-PHILOSOPHY.md](docs/policies/REPOSITORY-PHILOSOPHY.md) | Filosofia de uso del repositorio y del sistema |

### Make.com (Automatizaciones)
| Archivo | Descripcion |
|---------|-------------|
| [docs/make-pipeline/pipeline-overview.md](docs/make-pipeline/pipeline-overview.md) | Pipeline de 8 etapas de Make.com |
| [docs/make-pipeline/scenarios-analysis.md](docs/make-pipeline/scenarios-analysis.md) | Analisis detallado de escenarios de IA |

### Historial de cambios
| Archivo | Descripcion |
|---------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Historial completo de cambios por fecha |

## Quick Start

```bash
# Clonar
git clone https://github.com/gviollaz/iita-system.git

# Frontend
cd apps/crm-frontend && npm install && npm run dev
```

## Stack tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Frontend | React 19 + Vite 6 |
| Base de datos | PostgreSQL 17 (Supabase) |
| API | Edge Functions (Deno) |
| Automatizaciones | Make.com |
| IA | OpenAI GPT + Claude (Anthropic) |

## Supabase

- **Project ID:** `cpkzzzwncpbzexpesock`
- **Region:** us-east-1
- **Dashboard:** https://supabase.com/dashboard/project/cpkzzzwncpbzexpesock
