# IITA CRM System

Sistema CRM multicanal para IITA (Instituto de Innovacion y Tecnologia Aplicada), Salta, Argentina.
Gestiona conversaciones por WhatsApp, Instagram, Messenger y Email con respuestas de IA.

## Quick Reference

- **Supabase Project ID:** `cpkzzzwncpbzexpesock`
- **Region:** us-east-1
- **API URL:** https://cpkzzzwncpbzexpesock.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/cpkzzzwncpbzexpesock
- **Frontend:** React 19 + Vite 6 (en `apps/crm-frontend/`)
- **Make.com:** 43 escenarios activos (en `automations/make-scenarios/`)

## Estructura del repo

```
iita-system/
├── CLAUDE.md                    # Este archivo
├── AGENTS.md                    # Contexto universal para cualquier IA
├── CONTRIBUTING.md              # Reglas de contribucion y nomenclatura
├── CHANGELOG.md                 # Historial de cambios
├── README.md                    # Indice maestro de documentacion
├── apps/crm-frontend/           # Frontend React (git subtree)
├── automations/make-scenarios/  # Escenarios Make.com (git subtree)
├── database/
│   ├── schema/                  # DDL: tables/, functions/, triggers/, enums/
│   ├── edge-functions/          # Codigo fuente de Edge Functions
│   └── migrations/              # Historial de migraciones
├── scripts/                     # Scripts de mantenimiento
└── docs/                        # Documentacion completa
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
- **NO hacer DELETE** en `persons` o `interactions` — tienen dependencias en cascada
- Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` (acceso total)
- El bucket `media` de Storage es publico

## Comandos del frontend

```bash
cd apps/crm-frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # Build produccion
```

## Sincronizacion con repos originales

```bash
git subtree pull --prefix=apps/crm-frontend https://github.com/IITA-Proyectos/iitacrm.git main
git subtree pull --prefix=automations/make-scenarios https://github.com/gviollaz/iita-make-scenarios.git main
```
