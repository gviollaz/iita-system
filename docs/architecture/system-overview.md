# Arquitectura del sistema — IITA CRM

Ultima actualizacion: 2026-02-21 | Autor: gviollaz + Claude Opus 4.6

## Historia: migracion desde el sistema legacy

El sistema actual reemplazo al **Chatbot IITA 2.0** en febrero 2026. El sistema anterior era una aplicacion Django + Flask desplegada en una VM propia con PostgreSQL local, que manejaba WhatsApp e Instagram mediante adaptadores Flask propios y generacion de IA con OpenAI en threads in-process.

La migracion conservo todos los datos historicos (~25K personas, ~102K interacciones, ~24K conversaciones) y redistribuyo la arquitectura: Make.com reemplazo a los adaptadores Flask, Supabase reemplazo a la VM con PostgreSQL, y React reemplazo a Django templates.

Para la documentacion tecnica completa del sistema anterior, ver `docs/legacy-system/`.

## Diagrama general

```
Canales de entrada              Make.com (backend)              Supabase                    Frontend
─────────────────              ────────────────────            ─────────                   ────────
WhatsApp Cloud API ──┐
WhatsApp Coexistence ┤         ┌─────────────────┐         ┌──────────────┐         ┌──────────────┐
Instagram ───────────┼────────>│  Webhooks        │────────>│  PostgreSQL  │<────────│  CRM React   │
Messenger ───────────┤         │  (Entrada)       │         │  (DB)        │         │  (Frontend)  │
Email ───────────────┘         └────────┬─────────┘         └──────┬───────┘         └──────────────┘
                                        │                          │                        │
                               ┌────────▼─────────┐        ┌──────▼───────┐                │
                               │  Procesamiento    │        │  Edge        │                │
                               │  + IA (Claude)    │        │  Functions   │<───────────────┘
                               │  + Aprobacion     │        │  (crm-api)   │
                               │  + Envio          │        └──────────────┘
                               └──────────────────┘
```

## Componentes

### 1. Canales de entrada
| Canal | Proveedor | Estado |
|-------|-----------|--------|
| IITA Chatbot | WhatsApp Cloud API | Activo |
| San Lorenzo Chico | WhatsApp Coexistence | Activo |
| IITA Salta / San Lorenzo | Instagram | Activo |
| Messenger | Facebook Messenger | Activo |

### 2. Make.com (Backend)
- 117 escenarios totales (43 activos, 74 inactivos)
- Pipeline de 8 etapas (ver `docs/make-pipeline/pipeline-overview.md`)
- Se conecta a Supabase via API REST y webhooks bidireccionales

### 3. Supabase (Base de datos + API)
- **PostgreSQL 17** con 30 tablas, 24 funciones RPC, 7 triggers, 13 enums
- **Edge Functions (Deno):** crm-api (v19), courses-crud (v1), create-test-user (v2)
- **Storage:** Bucket `media` (publico) para imagenes y videos
- **Auth:** Configurado pero sin implementar en frontend

### 4. Frontend CRM (React)
- React 19 + Vite 6, CSS custom properties (dark theme)
- Sin librerias UI externas — todo custom
- 4 paginas: Dashboard, Conversations, People, Courses

## Flujo de datos

```
Frontend ──(POST JSON)──> Edge Function crm-api ──(RPC)──> PostgreSQL
                                                              │
                                                        [triggers]
                                                              │
                                                              ▼
                                                     Make.com webhooks
                                                              │
                                                              ▼
                                                    Canal de mensajeria
```
