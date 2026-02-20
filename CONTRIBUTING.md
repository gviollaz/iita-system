# Guia de contribucion — IITA CRM System

## Idioma

- **Codigo:** Ingles (tablas, funciones, variables)
- **Documentacion:** Espanol (docs, comments, changelogs)
- **Commits:** Espanol o ingles, consistente dentro del mismo PR

## Formato de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>: <descripcion breve>

[cuerpo opcional]

Co-Authored-By: [IA] <noreply@provider.com>
AI-Tool: [herramienta]
AI-Model: [modelo]
Reviewed-By: [usuario humano]
```

### Tipos: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `migration`, `data`

### Trailers de IA (obligatorios si participo una IA)

| Trailer | Ejemplo |
|---------|---------|
| `Co-Authored-By` | `Claude Opus 4.6 <noreply@anthropic.com>` |
| `AI-Tool` | `Claude Code`, `Cursor`, `ChatGPT`, `Gemini` |
| `AI-Model` | `claude-opus-4-6`, `gpt-4o`, `gemini-2.0-flash` |
| `Reviewed-By` | `gviollaz` |

## Antes de hacer cambios

1. Leer `AGENTS.md` (contexto general)
2. Verificar `docs/bugs/BUGS-CONOCIDOS.md` si el issue esta documentado
3. Verificar `docs/proposals/PROPUESTAS-PENDIENTES.md` si ya hay propuesta
4. Verificar `proposals/features/INDEX.md` si hay un RFC relacionado con lo que vas a hacer
5. Verificar `proposals/changes/` si ya hay una propuesta de cambio puntual

## Despues de hacer cambios

1. Actualizar `CHANGELOG.md`
2. Si se modifico la DB: actualizar `docs/database/data-dictionary.md`
3. Si se aplico migracion: documentar en `docs/operations/MIGRATIONS-LOG.md`
4. Si se hizo operacion de datos: documentar en `docs/operations/DATA-OPERATIONS.md` con query de rollback
5. Si se resolvio bug: moverlo a "Resueltos" en `docs/bugs/BUGS-CONOCIDOS.md`
6. Si se ejecuto una propuesta de `proposals/changes/`: moverla a `proposals/changes/archive/` con estado `ejecutada`
7. Si se implemento un RFC de `proposals/features/`: actualizar el estado a `implementada` en el RFC y en `INDEX.md`

## Propuestas de cambio (para IAs con acceso limitado)

No todas las IAs tienen acceso a todos los repositorios del proyecto. Si estas trabajando en `iita-system` y necesitas proponer un cambio que afecta a otro repo (frontend React, Make.com) o a la base de datos de Supabase:

1. **Crea un archivo** en `proposals/changes/YYYY-MM-DD-descripcion-corta.md`
2. **Usa el template** que esta en `proposals/changes/TEMPLATE.md`
3. **Incluye codigo real** listo para aplicar, no pseudocodigo
4. **Identificate** con tu nombre de IA y modelo en el campo "Autor IA"

Las propuestas son revisadas por gviollaz o por Claude Code (que tiene acceso a todos los repos). Ver detalles completos en `AGENTS.md` seccion "Como proponer cambios".

### Repos destino posibles

| Repo destino en la propuesta | Significado |
|------------------------------|-------------|
| `iitacrm` | Cambio en el frontend React (`IITA-Proyectos/iitacrm`) |
| `iita-make-scenarios` | Cambio en escenarios Make.com (`gviollaz/iita-make-scenarios`) |
| `supabase-migration` | Migracion SQL para aplicar en Supabase |
| `supabase-edge-function` | Cambio en Edge Functions para deployar en Supabase |
| `iita-system` | Cambio en este mismo repo (docs, schema, etc.) — aplicar directo |

## Nomenclatura de base de datos

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

## Nomenclatura de frontend

| Objeto | Convencion | Ejemplo |
|--------|-----------|---------|
| Componentes | PascalCase | `GenericTable`, `Lightbox` |
| Paginas | PascalCase.jsx | `Conversations.jsx` |
| Hooks | `use{Desc}` | `useIsMobile` |
| CSS vars | `--kebab-case` | `--bg-card` |
| Path alias | `@/` = `src/` | `import { Badge } from '@/components/ui'` |
