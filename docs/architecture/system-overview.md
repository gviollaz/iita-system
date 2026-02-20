# Arquitectura del sistema — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

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
