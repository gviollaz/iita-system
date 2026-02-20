# Politica de Colaboracion con IA

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Principio

Cualquier IA puede contribuir al proyecto. No hay restriccion de proveedor ni modelo. Lo importante es que cada contribucion quede correctamente documentada y atribuida.

---

## IAs Conocidas

| Proveedor | Herramienta | Modelos comunes | Email para atribucion |
|-----------|-------------|-----------------|----------------------|
| Anthropic | Claude Code, Claude Chat | claude-opus-4-6, claude-sonnet-4, etc. | noreply@anthropic.com |
| OpenAI | ChatGPT, API | gpt-4o, o1, etc. | noreply@openai.com |
| Google | Gemini, AI Studio | gemini-2.0, etc. | noreply@google.com |
| GitHub | Copilot | copilot | noreply@github.com |

Esta tabla no es exhaustiva. Si se usa una IA no listada, agregar una fila y usar el email de noreply del proveedor.

---

## Trailers Obligatorios en Commits

Todo commit que incluya trabajo realizado con asistencia de IA debe incluir los siguientes trailers:

```
Co-Authored-By: NombreIA <email@proveedor.com>
AI-Tool: nombre-de-la-herramienta
AI-Model: modelo-especifico
Reviewed-By: nombre-del-humano-que-reviso
```

### Ejemplos

**Contribucion con Claude Code:**
```
Agregar trigger de prevencion de ecos en interactions

Crea trg_prevent_echo_interaction que detecta y bloquea mensajes
eco basandose en external_ref y direction.

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: gviollaz
```

**Contribucion con ChatGPT:**
```
Refactorizar componente Dashboard para mejorar rendimiento

Memoiza calculos de KPIs y reduce re-renders innecesarios.

Co-Authored-By: ChatGPT <noreply@openai.com>
AI-Tool: ChatGPT
AI-Model: gpt-4o
Reviewed-By: gviollaz
```

**Contribucion con Gemini:**
```
Agregar funcion de busqueda full-text en personas

Implementa search_persons con tsvector para busqueda en nombre,
email y telefono.

Co-Authored-By: Gemini <noreply@google.com>
AI-Tool: Gemini
AI-Model: gemini-2.0-flash
Reviewed-By: gviollaz
```

**Multiples IAs en un commit:**
```
Migrar media de base64 a Supabase Storage

Claude diseno la migracion SQL, ChatGPT genero el script de
migracion de datos existentes.

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: ChatGPT <noreply@openai.com>
AI-Tool: Claude Code, ChatGPT
AI-Model: claude-opus-4-6, gpt-4o
Reviewed-By: gviollaz
```

---

## Flujo de Trabajo para Cualquier IA

### Antes de empezar

1. **Leer AGENTS.md** (si existe en la raiz del proyecto). Contiene instrucciones especificas del agente.
2. **Leer CLAUDE.md** (o equivalente). Contiene contexto del proyecto, arquitectura y convenciones.
3. **Revisar estado actual:**
   - `docs/bugs/BUGS-CONOCIDOS.md` - Bugs abiertos y resueltos
   - `docs/features/FEATURES.md` - Features implementadas y planificadas
   - `docs/proposals/PROPUESTAS-PENDIENTES.md` - Propuestas no implementadas
   - `docs/features/ROADMAP.md` - Plan de trabajo y prioridades
4. **Verificar contexto de la tarea:** Entender en que fase del roadmap se encuentra el proyecto y como la tarea encaja en el plan.

### Durante el trabajo

1. Seguir las convenciones de nombres definidas en `docs/policies/NAMING-CONVENTIONS.md`.
2. Comentar el codigo segun `docs/policies/CODE-COMMENTS.md`.
3. Si se crea una migracion, documentarla en `docs/operations/MIGRATIONS-LOG.md`.
4. Si se ejecuta una operacion de datos, documentarla en `docs/operations/DATA-OPERATIONS.md`.
5. Si se encuentra un bug nuevo, agregarlo a `docs/bugs/BUGS-CONOCIDOS.md`.
6. Si se resuelve un bug, moverlo a la seccion de resueltos con la fecha y descripcion del fix.

### Despues de terminar

Actualizar la documentacion relevante antes de hacer el commit:

| Que cambio | Que actualizar |
|------------|----------------|
| Cualquier cambio | Mensaje de commit con trailers obligatorios |
| Cambio en esquema de DB (tablas, columnas, funciones, triggers) | `docs/operations/MIGRATIONS-LOG.md` |
| Operacion de datos (INSERT/UPDATE/DELETE masivo) | `docs/operations/DATA-OPERATIONS.md` |
| Bug resuelto | `docs/bugs/BUGS-CONOCIDOS.md` - mover a resueltos |
| Bug descubierto | `docs/bugs/BUGS-CONOCIDOS.md` - agregar a abiertos |
| Feature implementada | `docs/features/FEATURES.md` - cambiar estado |
| Cambio en estructura de tablas | Actualizar data dictionary si existe |

---

## Responsabilidades del Humano

1. **Revisar** todo el codigo generado por IA antes de aplicarlo en produccion.
2. **Aprobar** o rechazar los cambios propuestos.
3. **Agregar** el trailer `Reviewed-By` en el commit.
4. **Verificar** que la documentacion fue actualizada correctamente.
5. **Decidir** si una propuesta pendiente se implementa o no.

---

## IAs con Acceso Limitado (ChatGPT, Gemini, Copilot, etc.)

Muchas IAs solo pueden ver un repositorio a la vez. Si solo tenes acceso a `iita-system`:

### Lo que SI podes hacer directamente

1. **Leer** toda la documentacion, schema SQL, Edge Functions, propuestas.
2. **Actualizar documentacion:** bugs, features, changelog, data-dictionary, ERD.
3. **Crear propuestas de cambio** en `proposals/changes/` para codigo que no podes modificar directamente.
4. **Analizar** el sistema y documentar hallazgos, bugs, o mejoras.

### Lo que NO podes hacer (usa propuestas)

1. **Modificar codigo React** → Crea propuesta con repo destino `iitacrm`
2. **Modificar escenarios Make.com** → Crea propuesta con repo destino `iita-make-scenarios`
3. **Ejecutar migraciones SQL** → Crea propuesta con repo destino `supabase-migration`
4. **Deployar Edge Functions** → Crea propuesta con repo destino `supabase-edge-function`

### Flujo completo para IAs con acceso limitado

```
1. Lee AGENTS.md (contexto completo del proyecto)
2. Lee la documentacion relevante a tu tarea
3. Trabaja en tu tarea:
   a. Si es documentacion → modifica directamente en iita-system
   b. Si es codigo/SQL → crea propuesta en proposals/changes/
4. Identificate siempre (Autor IA + modelo)
5. Actualiza CHANGELOG.md si corresponde
```

### Ejemplo concreto

Si ChatGPT detecta un bug en el frontend y quiere proponer un fix:

1. Documenta el bug en `docs/bugs/BUGS-CONOCIDOS.md`
2. Crea `proposals/changes/2026-02-21-fix-nombre-del-bug.md` con:
   - Descripcion del problema
   - Archivo y linea a modificar en `iitacrm`
   - Codigo exacto del fix
   - Como verificar
3. gviollaz o Claude Code revisan la propuesta y la ejecutan

---

## Lo que Ninguna IA Debe Hacer

1. **No** hacer push a produccion sin revision humana.
2. **No** ejecutar operaciones destructivas en la DB de produccion sin autorizacion explicita.
3. **No** modificar configuraciones de seguridad (JWT, CORS, RLS) sin revision.
4. **No** crear credenciales o tokens de acceso.
5. **No** ignorar bugs conocidos o propuestas pendientes relevantes al trabajo actual.
6. **No** inventar datos para pruebas en la DB de produccion.
7. **No** marcar una propuesta de cambio como "aprobada" o "ejecutada" — solo humanos o Claude Code pueden hacerlo.
8. **No** omitir la identificacion de autor IA en ningun cambio o propuesta.
