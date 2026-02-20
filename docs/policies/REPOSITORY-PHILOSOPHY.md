# Filosofia del repositorio y del sistema — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

## Sobre el repositorio

### Repositorio unificado
Este repo (`iita-system`) contiene TODO: frontend, backend, base de datos, documentacion. Los repos originales siguen existiendo:
- `IITA-Proyectos/iitacrm` — Frontend (fuente de verdad para codigo React)
- `gviollaz/iita-make-scenarios` — Make.com (fuente de verdad para escenarios)

Se sincronizan via `git subtree pull/push`.

### Por que un solo repo
- Cualquier IA puede ver todo el sistema en un solo lugar
- La documentacion esta junto al codigo
- Un solo CHANGELOG, un solo lugar para bugs, un solo roadmap
- No hay que saltar entre repos para entender como funciona algo

## Sobre el sistema

### 1. Datos primero
Toda operacion deja registro en la DB. No hay estado solo en memoria. Si algo paso, hay un registro en `interactions`, `ai_interaction`, `person_soft_data` o `person_enrichment_log`.

### 2. Idempotencia
Las funciones RPC manejan duplicados silenciosamente:
- `process_incoming_message` chequea `external_ref` duplicado
- `approve_ai_response` chequea si ya fue aprobada
- `prevent_echo_interaction` bloquea ecos sin error

### 3. Trazabilidad
- Cada dato enriquecido tiene `_ia_analysis_meta` en person_soft_data
- Cada enriquecimiento se registra en `person_enrichment_log`
- Cada commit tiene trailers de IA
- Cada migracion tiene rollback documentado

### 4. No pisar datos
- Scripts de enriquecimiento solo INSERT, nunca UPDATE
- Si un dato ya existe en `person_soft_data`, se preserva
- DELETE solo con documentacion y rollback

### 5. Reversibilidad
Toda operacion masiva puede revertirse:
- Migraciones: rollback en `MIGRATIONS-LOG.md`
- Datos: rollback en `DATA-OPERATIONS.md`
- Edge Functions: redeployar version anterior
- Frontend: revert en git

### 6. Seguridad como deuda tecnica consciente
El sistema tiene problemas de seguridad documentados (Edge Functions sin JWT, CORS abierto, RLS permisivo). Son deuda tecnica conocida, no descuidos. El roadmap los prioriza como Fase 1.

### 7. El mensaje es el nucleo
Todo gira alrededor de `interactions`:
- Entrante: `id_person_conversation` set
- Saliente: `id_system_conversation` set
- Nunca ambos (`chk_single_direction`)
- Triggers notifican a Make.com
- `ai_interaction` se vincula via `associated_interaction_id`
