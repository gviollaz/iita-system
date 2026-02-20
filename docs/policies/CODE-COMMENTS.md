# Politica de Comentarios en Codigo

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Principios Generales

1. Los comentarios explican el **por que**, no el **que**. El codigo debe ser autoexplicativo.
2. Si un bloque de codigo necesita un comentario largo para entenderse, considerar refactorizarlo.
3. Los comentarios desactualizados son peores que la ausencia de comentarios. Mantenerlos al dia.
4. Usar espanol para comentarios de negocio y documentacion. Usar ingles para comentarios tecnicos si es necesario (ej: nombres de algoritmos, referencias a APIs externas).

---

## Funciones SQL (PostgreSQL)

### Encabezado obligatorio

Toda funcion SQL debe tener un comentario de encabezado con:
- Descripcion breve de lo que hace
- Parametros de entrada y su proposito
- Nota de seguridad si aplica

```sql
-- ============================================================
-- Funcion: get_chat_detail
-- Descripcion: Devuelve el detalle completo de una conversacion
--   incluyendo interacciones, persona, canal y respuestas IA.
-- Parametros:
--   p_conversation_id (bigint) - ID de la conversacion
-- Seguridad: SET search_path = public
-- Creado: 2026-02-18 | Autor: Equipo IITA + Claude
-- ============================================================
CREATE OR REPLACE FUNCTION get_chat_detail(p_conversation_id bigint)
...
```

### Comentarios inline

Usar comentarios inline para logica compleja dentro de funciones:

```sql
-- Bloqueo FOR UPDATE para prevenir condiciones de carrera
-- cuando multiples webhooks intentan crear la misma conversacion
SELECT id INTO v_existing_id
FROM conversations
WHERE external_ref = p_external_ref
FOR UPDATE;
```

---

## Triggers

Cada trigger debe documentar:
- Tabla sobre la que actua
- Momento de ejecucion (BEFORE/AFTER INSERT/UPDATE/DELETE)
- Proposito

```sql
-- ============================================================
-- Trigger: trg_prevent_echo_interaction
-- Tabla: interactions
-- Timing: BEFORE INSERT
-- Proposito: Bloquea la insercion de mensajes eco (duplicados
--   salientes) detectando external_ref ya existente en la misma
--   conversacion.
-- Creado: 2026-02-19 | Autor: Equipo IITA + Claude
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_echo_interaction()
...
```

---

## Edge Functions (Deno/TypeScript)

### Encabezado de archivo

```typescript
/**
 * crm-api - API principal del CRM
 *
 * Endpoints:
 *   - stats, msgs_per_day, volume_by_channel (analytics)
 *   - persons_list, person_full, search_persons (personas)
 *   - select, insert, update, delete (CRUD generico)
 *
 * Seguridad: verify_jwt = false (pendiente FEAT-010)
 *
 * Creado: 2026-02-18 | Autor: Equipo IITA + Claude
 */
```

### Comentarios de endpoints

```typescript
// --- Endpoint: stats ---
// Devuelve KPIs generales del dashboard
// Llama a RPC get_crm_stats()
case 'stats':
  ...
```

### Comentarios de logica de negocio

```typescript
// La aprobacion cambia el estado de pending a approved en ai_interaction.
// Esto dispara el flujo de envio en Make.com via webhook.
// IMPORTANTE: No cambiar el nombre del campo 'evaluation' sin actualizar
// el escenario de Make.com que lo consulta.
```

---

## Frontend (React/JSX)

### Comentarios de decisiones de diseno

Comentar cuando una decision de implementacion no es obvia:

```jsx
// Usamos GenericTable con edicion inline en vez de un formulario modal
// porque el ABM de cursos tiene muchos campos y el modal quedaba muy largo.
// La edicion inline permite ver el contexto de otros registros mientras se edita.
```

### Comentarios de workarounds

```jsx
// WORKAROUND: Supabase devuelve person_conversation como array anidado.
// unwrap() normaliza la estructura para que el frontend pueda iterar.
// Esto se puede eliminar cuando se refactorice la RPC get_conversations.
const data = unwrap(response);
```

### No comentar lo obvio

```jsx
// MAL: Incrementa el contador
setCount(count + 1);

// BIEN: (sin comentario, el codigo es autoexplicativo)
setCount(count + 1);
```

---

## Documentacion de Archivos

### Encabezado obligatorio en documentos

Todo documento Markdown debe empezar con:

```markdown
# Titulo del Documento

**Fecha:** YYYY-MM-DD
**Autor:** Nombre + AI (si aplica)
```

---

## Atribucion

### En commits

La atribucion se hace via trailers en el mensaje de commit (ver AI-COLLABORATION.md):

```
Co-Authored-By: Claude <noreply@anthropic.com>
AI-Tool: Claude Code
AI-Model: claude-opus-4-6
Reviewed-By: nombre-humano
```

### En codigo

Cuando una funcion o bloque significativo fue creado con asistencia de IA, agregar una linea de atribucion en el encabezado:

```sql
-- Creado: 2026-02-18 | Autor: Equipo IITA + Claude
```

```typescript
// Creado: 2026-02-18 | Autor: Equipo IITA + Claude
```

**Formato:** `-- Creado: YYYY-MM-DD | Autor: quien + AI`

### Reglas de atribucion

1. No atribuir cada linea individual. La atribucion va en el encabezado de la funcion/archivo.
2. Si multiples IAs contribuyeron al mismo archivo, listar todas en el encabezado.
3. La atribucion en el codigo es complementaria a la del commit, no la reemplaza.
4. El humano que reviso y aprobo el cambio siempre se incluye como `Reviewed-By` en el commit.
