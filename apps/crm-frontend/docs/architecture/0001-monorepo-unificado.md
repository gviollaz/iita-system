# ADR 0001: Repositorio unificado del sistema IITA CRM

**Fecha:** 2026-02-20
**Estado:** Propuesto (pendiente de aprobacion)
**Autor:** Claude Opus 4.6 (AI-assisted), solicitado por Gerardo Viollaz

---

## Contexto y problema

El sistema vive actualmente en 2 repositorios independientes + una base de datos sin versionamiento local:

| Componente | Repo | Problema |
|------------|------|----------|
| Frontend React | `IITA-Proyectos/iitacrm` | OK pero aislado |
| Make.com scenarios | `gviollaz/iita-make-scenarios` | Diferente org, diferente owner |
| Base de datos | Sin repo (solo en Supabase) | Migraciones sin version local, funciones sin backup |
| Edge Functions | Sin repo | Codigo solo en Supabase dashboard |
| Documentacion | Repartida entre ambos repos | Fragmentada, dificil dar contexto a IAs |

**Problemas concretos:**
1. IAs como ChatGPT y Gemini no pueden acceder al MCP de Supabase → no ven el esquema de DB
2. No hay un lugar unico donde ver el modelo de datos, triggers, funciones
3. Cambios atomicos (frontend + DB + Make.com) requieren commits en repos separados
4. Cada IA que trabaja en el proyecto necesita contexto fragmentado

---

## Propuesta: Repositorio general unificado

Crear un nuevo repositorio `iita-system` (o `iita-crm-system`) que contenga todo, manteniendo los repos existentes como estan.

### Estructura propuesta

```
iita-system/
├── CLAUDE.md                          # Contexto para Claude Code (conciso, <80 lineas)
├── AGENTS.md                          # Contexto universal para todas las IAs
├── CONTRIBUTING.md                    # Reglas de contribucion, nomenclatura, atribucion
├── CHANGELOG.md                       # Changelog unificado (formato Keep-a-Changelog)
│
├── apps/
│   └── crm-frontend/                 # Git subtree o copia del repo iitacrm
│       ├── src/
│       ├── package.json
│       └── ...
│
├── automations/
│   └── make-scenarios/                # Git subtree o copia del repo iita-make-scenarios
│       ├── snapshots/
│       ├── fixes/
│       ├── make_sync.py
│       └── docs/
│
├── database/
│   ├── schema/
│   │   ├── tables/                    # Un .sql por tabla con COMMENT ON
│   │   ├── functions/                 # Un .sql por funcion RPC
│   │   ├── triggers/                  # Un .sql por trigger
│   │   └── enums/                     # Tipos enum
│   ├── migrations/                    # Copia local de migraciones aplicadas
│   ├── edge-functions/
│   │   ├── crm-api/                   # Codigo fuente de la Edge Function
│   │   ├── courses-crud/
│   │   └── create-test-user/
│   └── seeds/                         # Datos iniciales (channels, branches, providers)
│
├── scripts/
│   ├── analyze-conversations.mjs      # Script de enriquecimiento
│   └── export-schema.sql              # Script para exportar schema desde Supabase
│
└── docs/
    ├── database/
    │   ├── data-dictionary.md         # Diccionario de datos completo
    │   ├── erd.md                     # Diagramas Mermaid
    │   ├── triggers.md                # Documentacion de triggers
    │   └── functions.md               # Documentacion de funciones RPC
    ├── architecture/
    │   ├── 0001-monorepo-unificado.md # Este documento
    │   └── system-overview.md         # Vision general del sistema
    ├── make-pipeline.md               # Pipeline de 8 etapas de Make.com
    └── PROPUESTAS-PENDIENTES.md       # Propuestas sin implementar
```

### Sincronizacion con repos existentes

**Opcion A: Git subtree (recomendada)**
```bash
# Agregar repos existentes como subtrees
git subtree add --prefix=apps/crm-frontend https://github.com/IITA-Proyectos/iitacrm.git main
git subtree add --prefix=automations/make-scenarios https://github.com/gviollaz/iita-make-scenarios.git main

# Para sincronizar cambios
git subtree pull --prefix=apps/crm-frontend https://github.com/IITA-Proyectos/iitacrm.git main
git subtree push --prefix=apps/crm-frontend https://github.com/IITA-Proyectos/iitacrm.git main
```

**Opcion B: Git submodules**
Mas ligero pero peor experiencia para IAs (no ven el contenido directamente).

**Opcion C: Copia manual periodica**
Mas simple pero riesgo de divergencia. Aceptable como inicio.

---

## Reglas de contribucion propuestas

### Nomenclatura de base de datos

| Objeto | Convencion | Ejemplo |
|--------|-----------|---------|
| Tablas | `snake_case`, plural | `interactions`, `persons`, `course_editions` |
| Columnas | `snake_case` | `first_name`, `created_at`, `channel_provider_id` |
| PK | `id` (integer autoincrement) | `id` |
| FK | `{tabla_singular}_id` o `id_{tabla}` | `person_id`, `id_conversation` |
| Indices | `idx_{tabla}_{columnas}` | `idx_interactions_status` |
| Triggers | `trg_{accion}_{tabla}` | `trg_prevent_echo_interaction` |
| Funciones | `{verbo}_{sustantivo}` | `get_conversations`, `approve_ai_response` |
| Enums | `{tabla}_{campo}` | `interaction_status`, `course_edition_status` |

**Desvios actuales a corregir gradualmente:**
- `id_person_conversation` vs `person_id` (inconsistente uso de prefijo `id_`)
- `channels.descrption` (typo, deberia ser `description`)
- `ai_interaction` (singular, deberia ser `ai_interactions`)

### Atribucion de cambios (multi-IA)

Cada commit debe incluir trailers que indiquen:

```
fix: corregir URL de media en get_chat_detail

La funcion retornaba content_dir (path relativo) pero el frontend
esperaba url (URL completa). Ahora la RPC construye la URL publica.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: gviollaz
```

**Trailers estandar:**
| Trailer | Uso | Ejemplos |
|---------|-----|----------|
| `Co-Authored-By` | IA que genero el codigo | `Claude Opus 4.6 <noreply@anthropic.com>` |
| `AI-Tool` | Herramienta usada | `Claude Code`, `Cursor`, `ChatGPT`, `Gemini` |
| `AI-Model` | Modelo especifico | `claude-opus-4-6`, `gpt-4o`, `gemini-2.0-flash` |
| `Reviewed-By` | Humano que reviso/aprobo | `gviollaz` |

### Formato de CLAUDE.md

El `CLAUDE.md` raiz debe ser conciso (<80 lineas) con:
- Que es el proyecto (2 lineas)
- Arquitectura (link a docs)
- Supabase Project ID y URLs criticas
- Warnings criticos (ej: no habilitar JWT sin login)
- Links a docs especificos por componente

Cada componente puede tener su propio `CLAUDE.md`:
- `apps/crm-frontend/CLAUDE.md` — stack, comandos, path aliases
- `automations/make-scenarios/CLAUDE.md` — como usar make_sync.py
- `database/CLAUDE.md` — como aplicar migraciones, convenciones SQL

### AGENTS.md (universal, para todas las IAs)

Archivo `AGENTS.md` en la raiz como contexto universal para cualquier IA:
- Resumen del proyecto
- Estructura del repo
- Convenciones de codigo
- Testing requerido
- Lo que NO hacer (warnings criticos)

---

## Pasos de implementacion

### Fase 1: Crear repositorio y copiar docs (inmediato)
1. Crear repo `iita-system` en GitHub
2. Copiar documentacion existente
3. Agregar diccionario de datos, ERD, funciones
4. Crear CLAUDE.md, AGENTS.md, CONTRIBUTING.md

### Fase 2: Agregar codigo (1 semana)
1. Agregar frontend como subtree
2. Agregar make-scenarios como subtree
3. Exportar Edge Functions y agregarlas a `database/edge-functions/`
4. Exportar schema SQL y agregarlas a `database/schema/`

### Fase 3: Automatizar (2 semanas)
1. Script para exportar schema desde Supabase y actualizar docs
2. GitHub Action para validar que ERD y diccionario esten actualizados
3. Pre-commit hook para validar formato de commits (trailers)

---

## Consecuencias

### Positivas
- Un solo lugar para entender todo el sistema
- Cualquier IA puede recibir contexto completo solo con el repo
- Commits atomicos (frontend + DB + Make.com)
- Diccionario de datos versionado y siempre actualizado
- Colaboracion multi-persona + multi-IA con trazabilidad

### Negativas
- Repo mas grande (Make.com JSONs son pesados)
- Sincronizacion bidireccional con repos originales requiere disciplina
- Migrar contribuidores a un nuevo repo tiene friccion inicial

### Neutrales
- Los repos originales pueden seguir existiendo como mirrors
- No requiere cambiar el workflow de deploy (Vercel sigue apuntando al frontend)
