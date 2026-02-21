# Base de Datos Legacy — Chatbot IITA 2.0

Última actualización: 2026-02-21 | Autor: gviollaz + Claude Opus 4.6

## Sobre esta documentación

Esta documentación fue generada con **acceso directo a los datos de producción** del sistema legacy (proyecto Supabase `kdwdknuhowdehknztark`, backup de la BD PostgreSQL original del Chatbot IITA 2.0). Cada campo y relación fue validado contra contenidos reales, corrigiendo supuestos previos que se habían hecho solo desde el código fuente.

**Proyecto Supabase:** `chatbot Legacy (prod backup)` — región `us-west-2`
**Datos:** mayo 2024 – diciembre 2025 (19 meses de operación)
**Volumen:** 22K personas, 80K mensajes, 22K conversaciones, 22K respuestas IA

## Documentos

| Archivo | Descripción |
|---------|-------------|
| [schema-reference.md](schema-reference.md) | Referencia completa del esquema: 36 tablas, columnas, tipos, PKs, FKs, índices, constraints, RLS |
| [data-dictionary.md](data-dictionary.md) | Diccionario de datos campo por campo, con descripción funcional validada contra datos reales |
| [erd.md](erd.md) | Diagramas Entidad-Relación en Mermaid: dominio original Django + tablas normalizadas agregadas |
| [data-analysis.md](data-analysis.md) | Análisis estadístico: volumetría, tasas de llenado, distribuciones, hallazgos |
| [corrections.md](corrections.md) | Correcciones a documentación previa basadas en validación con datos reales |

## Estructura de tablas por dominio

```
DJANGO CORE (original)
├── Empresa y canales ─── core_companies, core_branches, core_chatproviders, core_companycomchannels
├── Personas ──────────── core_persons, core_personcomchannels, core_empleado
├── Conversaciones ────── core_conversations, core_interactions, core_media
├── Etiquetas legacy ──── core_interests, core_personbyinterest
├── IA ─────────────────── core_aiproviders, core_aimodels, core_aiparams, core_values
│                          core_respondentcache, core_respondentcache_values
│                          core_aiinteractions, core_aiinteractionlog, core_airequestlog
├── Cursos ─────────────── core_courses, core_courseedition
├── Config ─────────────── core_settings, core_companiesdata, core_limit, core_rol
└── Django admin ───────── auth_user, auth_group, auth_permission, django_*

TABLAS NORMALIZADAS (agregadas post-migración)
├── core_tags ──────────── Catálogo normalizado de etiquetas con tipos
├── core_person_tags ───── Relación persona↔etiqueta con trazabilidad
├── core_person_profile ── Perfil enriquecido 1:1 por persona
├── core_person_channels ─ Canales unificados por persona
├── core_lead_inquiry ──── Consultas comerciales con seguimiento (vacía)
└── contactos ──────────── Importación de agenda WhatsApp (externa a Django)
```

## Relación con el sistema actual (iita-base)

El sistema actual (`cpkzzzwncpbzexpesock`) migró los datos del legacy con las siguientes correspondencias principales:

| Legacy (Django) | Actual (iita-base) | Notas |
|---|---|---|
| `core_persons` | `persons` | Migración directa |
| `core_interactions` | `interactions` | Restructurado: se eliminó dual FK, se usa sender enum |
| `core_conversations` | `conversations` | Simplificado |
| `core_personcomchannels` | `person_contacts` | Renombrado |
| `core_companycomchannels` | `channels` | Aplanado |
| `core_interests` + `core_personbyinterest` | `interests` + `person_interest` → luego `person_soft_data` | Evolución progresiva |
| `core_aiinteractions` + `core_aiinteractionlog` | `ai_interaction` | Combinado |
| `core_courses` / `core_courseedition` | `courses` / `course_editions` | Expandido |
| `contactos` | (importado a `core_person_*`) | Datos incorporados |
