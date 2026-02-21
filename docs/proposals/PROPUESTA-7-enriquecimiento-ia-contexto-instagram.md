# Propuesta #7 — Enriquecimiento IA, Extracción Incremental de Datos e Instagram

**Fecha:** 2026-02-21  
**Autor:** Claude (Anthropic) + Equipo IITA  
**Estado:** Propuesta documentada, pendiente de implementación  
**Prioridad:** P1 (alto impacto en calidad de respuestas IA y datos de personas)

---

## Resumen ejecutivo

Esta propuesta aborda 6 problemas interconectados que limitan la calidad de las respuestas de la IA y la completitud de los datos de personas en el sistema:

1. **La IA genera respuestas sin conocer al interlocutor** — No recibe datos enriquecidos de la persona (cursos de interés, modalidad preferida, hijos, etc.)
2. **El enriquecimiento es estático y no se actualiza** — Solo inserta datos nuevos, nunca actualiza datos obsoletos
3. **No se extraen datos incrementalmente de cada conversación** — Solo un proceso batch que corre una vez por persona
4. **No se registra el "nombre preferido"** — La persona puede querer que la llamen de una forma distinta a su nombre legal
5. **Instagram pierde el username** — Solo se captura el ID numérico (IGSID), no el @username
6. **El frontend no muestra el username de Instagram** — Aunque existe la columna `contact_username`, nunca se puebla ni se muestra

---

## 1. Contexto actual: datos enriquecidos y su uso

### 1.1 Estado de `person_soft_data`

La tabla `person_soft_data` contiene **93,000+ registros** con datos extraídos automáticamente por el Edge Function `enrich-persons`. Distribución por tipo:

| data_name | Registros | Personas cubiertas |
|-----------|-----------|--------------------|
| pais | 21,131 | ~21K |
| provincia | 17,665 | ~17K |
| tag_curso_interes | 17,001 | 14,088 (55%) |
| nombre_contacto | 9,768 | ~9.7K |
| pref_modalidad | 7,555 | ~7.5K |
| tiene_hijos | 6,413 | ~6.4K |
| ocupacion | 5,422 | ~5.4K |
| ciudad | 4,627 | ~4.6K |
| nivel_educativo | 2,345 | ~2.3K |
| rango_edad | 1,087 | ~1K |
| _ia_analysis_meta | 23,152 | — (registro de auditoría) |
| ... y otros | — | — |

**Total personas enriquecidas:** 23,152 de 25,361 (91.3%)  
**Total personas con first_name NULL:** 18,080 (71.3%)

### 1.2 Cómo funciona el enriquecimiento actual (`enrich-persons`)

El Edge Function `enrich-persons` (v2) funciona así:

1. **pg_cron** ejecuta cada 55 segundos con `batch_size=12`
2. Selecciona personas que NO tengan registro `_ia_analysis_meta` en `person_soft_data`
3. Para cada persona, obtiene el transcript completo de sus conversaciones
4. Envía el transcript a **OpenAI gpt-4o-mini** con un prompt de extracción
5. Recibe un JSON estructurado con los datos extraídos
6. **Inserta los datos en `person_soft_data`**

#### Problema crítico: Insert-only

La función `insertExtractions()` tiene esta lógica:

```javascript
// Obtener datos existentes
const existingNames = existingData.map(d => d.data_name)
const existingNameSet = new Set(existingNames)

// Para cada dato extraído:
if (existingNameSet.has(dataName)) {
  // SKIP — ya existe, no se actualiza
  continue
}
// Solo inserta si el dato NO existía previamente
```

**Consecuencia:** Una vez que un dato se registra, NUNCA se actualiza. Si una persona dice en febrero "me interesa Robótica" y en marzo dice "en realidad quiero Python", el sistema mantiene "Robótica" para siempre.

**Excepción para tags:** Los campos tipo `tag_*` (como `tag_curso_interes`) sí acumulan múltiples valores — cada nuevo tag se agrega como un registro adicional. Pero un tag existente nunca se elimina.

**Bug encontrado:** La persona #9269 tiene registros DUPLICADOS de `nombre_contacto` y `pref_modalidad` con timestamps separados por ~3 segundos. Esto indica una race condition en el batch: la misma persona fue procesada dos veces antes de que el primer insert se completara.

### 1.3 Qué recibe la IA al generar respuestas

El escenario Make.com **4132827** ("AI Agent - Atencion al cliente y asesor de cursos") genera las respuestas de la IA. 

**La IA recibe:**
- Historial de la conversación (mensajes entrantes y salientes)
- System prompt con instrucciones de comportamiento ("Ana")
- Información de cursos disponibles (catálogo)

**La IA NO recibe:**
- ❌ Datos de `person_soft_data` (cursos de interés, modalidad, hijos, etc.)
- ❌ Nombre preferido de la persona
- ❌ Historial de otras conversaciones de la misma persona
- ❌ Datos de contacto (teléfono, email) para validar

**Impacto:** La IA no puede personalizar la respuesta. No sabe que la persona ya consultó sobre Robótica, que prefiere modalidad online, o que tiene hijos (relevante para sugerir horarios). Cada conversación empieza "de cero" para la IA.

---

## 2. Propuesta: Alimentar la IA con contexto de persona

### 2.1 Qué datos incluir

Agregar al contexto del AI Agent (escenario 4132827) un bloque "Perfil del contacto" con:

```
--- PERFIL DEL CONTACTO ---
Nombre: María González
Nombre preferido: Mari
País: Argentina
Provincia: Santa Fe
Ciudad: Rosario
Ocupación: Docente
Tiene hijos: Sí
Modalidad preferida: Online
Cursos consultados: Robótica Educativa, Python, Marketing Digital
Última consulta: 2026-02-18
---
```

### 2.2 Cómo implementar

**Opción A — Query en Make.com (recomendada):**

Agregar un módulo HTTP al escenario 4132827, antes del AI Agent, que consulte un nuevo endpoint del Edge Function `crm-api`:

```javascript
// Nuevo endpoint: person_context
case 'person_context': {
  const { person_id } = params
  const { data: softData } = await supabase
    .from('person_soft_data')
    .select('data_name, data_content')
    .eq('person_id', person_id)
    .not('data_name', 'like', '_ia_%')  // excluir metadatos
    .order('id', { ascending: false })
  
  const { data: person } = await supabase
    .from('persons')
    .select('first_name, last_name')
    .eq('id', person_id)
    .single()
  
  // Agrupar por data_name, tomar el más reciente para campos simples
  // Acumular para tags
  const profile = buildProfile(softData, person)
  return profile
}
```

**Opción B — Supabase RPC:**

Crear un RPC `get_person_context(p_person_id)` que retorne un texto formateado listo para inyectar en el prompt.

### 2.3 Instrucciones para la IA

Agregar al system prompt de Ana:

```
## Contexto del contacto
Si se te proporciona un PERFIL DEL CONTACTO, úsalo para:
- Dirigirte a la persona por su nombre preferido
- No preguntar información que ya tenés (cursos de interés, modalidad, etc.)
- Sugerir horarios compatibles si tiene hijos
- Referirte a consultas anteriores si son relevantes
- NUNCA revelar que tenés esta información salvo que el contacto la mencione
```

### 2.4 Impacto estimado

- **Costo adicional por mensaje:** ~200 tokens extra de contexto ≈ USD 0.00006/msg con gpt-4o-mini
- **A 338 mensajes/semana:** ~USD 0.02/semana adicional (despreciable)
- **Mejora esperada:** Respuestas significativamente más personalizadas, menos preguntas redundantes al usuario

---

## 3. Propuesta: Extracción incremental de datos

### 3.1 Problema

Actualmente la extracción ocurre **una sola vez por persona** como proceso batch (`enrich-persons`). Si la persona actualiza su situación (cambió de provincia, se interesó en otro curso, ahora tiene hijos), esa información queda en las conversaciones pero NUNCA se extrae.

### 3.2 Solución: Extracción post-conversación

Agregar un paso al final del pipeline de Make.com (después de enviar la respuesta IA) que:

1. Tome los **últimos N mensajes** de la conversación (no todo el historial)
2. Los envíe a un modelo ligero (gpt-4o-mini) con un prompt de extracción diferencial
3. Compare los datos extraídos con los datos existentes
4. **Actualice** los datos que cambiaron

#### Prompt de extracción diferencial

```
Dados estos mensajes recientes de una conversación, extraé SOLO datos nuevos 
o que CONTRADIGAN los datos existentes del contacto.

Datos existentes del contacto:
- pais: Argentina
- modalidad: Online
- cursos_interes: Robótica Educativa

Mensajes recientes:
[últimos 5 mensajes]

Retorná un JSON con:
- datos_nuevos: {campo: valor} — datos que no existían
- datos_actualizados: {campo: {anterior: X, nuevo: Y, razon: "..."}} — datos que cambiaron
- nombre_preferido: string | null — cómo quiere que lo llamen
- confianza: "alta" | "media" | "baja"

Si no hay datos nuevos ni cambios, retorná un JSON vacío {}.
```

### 3.3 Modelo de datos mutable

**Principio:** La información más reciente tiene más valor que la antigua.

Cambios en `person_soft_data`:

```sql
-- Agregar columnas para tracking de actualizaciones
ALTER TABLE person_soft_data 
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'enrichment',
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS superseded_by bigint REFERENCES person_soft_data(id),
  ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;

-- Índice para queries de datos actuales
CREATE INDEX IF NOT EXISTS idx_psd_person_current 
  ON person_soft_data(person_id, data_name) 
  WHERE is_current = true;
```

Cuando un dato se actualiza:
1. Marcar el registro anterior con `is_current = false` y `superseded_by = nuevo_id`
2. Insertar el nuevo registro con `is_current = true`
3. Se mantiene el historial completo para auditoría

### 3.4 Modificar `enrich-persons` para soportar actualizaciones

Cambiar la lógica de `insertExtractions()` de:

```javascript
// ACTUAL: Skip si existe
if (existingNameSet.has(dataName)) continue
```

A:

```javascript
// NUEVO: Comparar y actualizar si difiere
if (existingNameSet.has(dataName)) {
  const existing = existingData.find(d => d.data_name === dataName && d.is_current)
  if (existing && existing.data_content !== newValue) {
    // Marcar anterior como superseded
    await supabase
      .from('person_soft_data')
      .update({ is_current: false })
      .eq('id', existing.id)
    // Insertar nuevo valor
    // ... (insert con superseded_by reference)
  } else {
    continue  // Mismo valor, no hacer nada
  }
}
```

### 3.5 Nombre preferido

Agregar el campo `nombre_preferido` como dato extraíble:

- **data_name:** `nombre_preferido`
- **Extracción:** Tanto en batch (`enrich-persons`) como incremental
- **Lógica:** Si la persona dice "decime Mari", "soy la profe Gaby", "llamame por mi segundo nombre, Daniel", registrar ese nombre
- **Uso:** La IA lo usa para dirigirse a la persona en la conversación
- **Diferencia con `nombre_contacto`:** El nombre de contacto es el nombre real/legal. El nombre preferido es cómo quiere que la llamen en el chat.

**Ejemplos de extracción:**
| Mensaje | nombre_preferido extraído |
|---------|---------------------------|
| "Hola, soy María pero decime Mari" | Mari |
| "Mi nombre es María Gabriela González" | (no extraer — no hay preferencia) |
| "Llamame profe" | Profe |
| "Soy la mamá de Julián" | (no extraer — es rol, no nombre) |

### 3.6 Cuándo ejecutar la extracción incremental

**Opción A — En cada interacción (NO recomendado):**  
Muy costoso. A 338 msgs/semana × USD 0.0003 = USD 0.10/semana. Pero genera latencia en el pipeline y muchos calls vacíos.

**Opción B — Al cerrar conversación (recomendado):**  
Ejecutar la extracción cuando:
- Se aprueba/rechaza la última IA de la conversación Y
- No hay mensajes nuevos del usuario en los últimos 30 minutos

Esto reduce los calls a ~100/semana (una por conversación activa), con USD 0.03/semana de costo.

**Opción C — Batch periódico con delta:**  
Similar al actual `enrich-persons`, pero en vez de procesar personas sin `_ia_analysis_meta`, procesar personas que tengan conversaciones nuevas desde la última extracción. Ejecutar cada 24h.

**Recomendación:** Opción B para datos urgentes (nombre preferido, curso de interés), Opción C para datos de perfil (ocupación, nivel educativo, ubicación).

---

## 4. Propuesta: Fix Instagram — Recuperar username

### 4.1 Problema actual

Datos de Instagram en la base de datos:

| Métrica | Valor |
|---------|-------|
| Conversaciones Instagram | 1,250 |
| Con `contact_username` poblado | **0** (0%) |
| Direcciones que son IGSID numérico | 1,250 (100%) |
| Personas IG con `first_name` NULL | 955 (76.4%) |
| Ejemplo de address | `8453647284735199` |

La columna `person_conversation.contact_username` existe en el schema pero **ningún flujo la puebla**.

### 4.2 Causa raíz

Los flujos de entrada de Instagram en Make.com:
- Capturan el IGSID (Instagram-Scoped ID) del mensaje webhook
- Lo almacenan como `address` en `person_conversation`
- **No consultan el Instagram Graph API** para obtener el username del usuario
- Usan la versión de 6 parámetros de `process_incoming_message` (sin `p_username`)

La función RPC `process_incoming_message` tiene dos sobrecargas:
```sql
-- Versión sin username (6 params) — usada por Instagram
process_incoming_message(p_address, p_channel_id, p_content, p_direction, p_msg_type, p_person_name)

-- Versión con username (7 params) — disponible pero no usada por IG
process_incoming_message(p_address, p_channel_id, p_content, p_direction, p_msg_type, p_person_name, p_username)
```

### 4.3 Solución propuesta

#### Paso 1: Obtener username del Instagram Graph API

En los escenarios de Make.com que procesan mensajes de Instagram, agregar un módulo HTTP **antes** de llamar a `process_incoming_message`:

```
GET https://graph.facebook.com/v19.0/{IGSID}?fields=username,name
Authorization: Bearer {PAGE_ACCESS_TOKEN}
```

**Respuesta esperada:**
```json
{
  "username": "maria_gonzalez_ok",
  "name": "María González",
  "id": "8453647284735199"
}
```

**Nota importante:** El campo `username` puede no estar disponible para todas las cuentas de Instagram (cuentas privadas, restricciones de API). En ese caso, usar `name` como fallback.

#### Paso 2: Pasar username a process_incoming_message

Cambiar los escenarios de Instagram para usar la versión de 7 parámetros:

```sql
SELECT process_incoming_message(
  '8453647284735199',     -- IGSID como address
  5,                       -- channel_id para Instagram
  'Hola, quiero info...',  -- contenido
  'incoming',              -- dirección
  'text',                  -- tipo
  'María González',        -- nombre del Graph API
  'maria_gonzalez_ok'      -- username del Graph API
)
```

#### Paso 3: Poblar `person_name` desde Graph API

Actualmente 955 personas de Instagram tienen `first_name = NULL`. El campo `name` del Graph API puede recuperar muchos de estos nombres.

#### Paso 4: Migración de datos históricos

Para las 1,250 conversaciones existentes sin username:

```sql
-- Script de migración (ejecutar una vez)
-- Requiere: Edge Function que consulte el Graph API en batch
-- para cada IGSID en person_conversation donde channel = Instagram
-- y actualice contact_username con el resultado
```

Esto requiere un Edge Function dedicado o un escenario de Make.com que:
1. Lea todos los IGSID sin username
2. Consulte el Graph API para cada uno (respetando rate limits: 200 calls/hora)
3. Actualice `person_conversation.contact_username` y `persons.first_name` si corresponde

**Estimado:** 1,250 IGSIDs ÷ 200/hora = ~6.25 horas para la migración completa.

### 4.4 Limitaciones conocidas

- **Rate limits del Graph API:** 200 calls/hora por token. Para mensajes en tiempo real no es problema (flujo normal), pero sí para la migración batch.
- **Cuentas sin username:** Algunas cuentas de Instagram no tienen username público. En ese caso, `contact_username` queda NULL y se usa `name` como identificador visual.
- **Permisos:** Verificar que el Page Access Token tenga el scope `instagram_manage_messages` que incluye acceso al perfil del usuario.

---

## 5. Propuesta: Frontend — Mostrar username de Instagram

### 5.1 Cambio en Conversations.jsx

Actualmente, para Instagram el frontend muestra el IGSID numérico como identificador. Con el username disponible:

```jsx
// ACTUAL:
<span>{conversation.address}</span>
// Muestra: 8453647284735199

// PROPUESTO:
<span>
  {conversation.contact_username 
    ? `@${conversation.contact_username}` 
    : conversation.person_name || conversation.address}
</span>
// Muestra: @maria_gonzalez_ok
```

### 5.2 Cambios específicos

1. **Lista de conversaciones:** Mostrar `@username` en vez de IGSID cuando esté disponible
2. **Header del chat:** Agregar el `@username` debajo del nombre de la persona
3. **Perfil de persona (People.jsx):** Mostrar `@username` como dato de contacto de Instagram
4. **Tooltip en la lista:** Mostrar IGSID como tooltip para debugging

### 5.3 Asegurar que la query retorne `contact_username`

Verificar que el RPC `get_conversations` ya incluya `contact_username` en el SELECT. Si no, agregarlo:

```sql
-- En get_conversations, en el JOIN con person_conversation:
pc.contact_username,
```

---

## 6. Validación de datos recibidos

### 6.1 Problema actual

El `enrich-persons` ya tiene validaciones básicas:
- Nombres: solo letras y espacios, 2-60 caracteres
- Teléfonos: formato `+XX XXXXXXXXX`, 8-20 dígitos
- Emails: regex básico
- Campos cortos: máximo 100 caracteres
- Enteros: `Number.isInteger()`

**Pero falta:**
- ❌ Validación de consistencia (provincia que no existe en el país)
- ❌ Detección de datos absurdos ("edad: 250", "país: Marte")
- ❌ Validación cruzada con datos existentes
- ❌ Detección de PII sensible que no debería almacenarse

### 6.2 Mejoras propuestas

#### Validación de ubicación
```javascript
// Lista de provincias válidas por país
const PROVINCIAS_ARGENTINA = ['Buenos Aires', 'CABA', 'Santa Fe', ...]

if (dataName === 'provincia' && existingCountry === 'Argentina') {
  if (!PROVINCIAS_ARGENTINA.includes(value)) {
    // Intentar fuzzy match antes de rechazar
    const match = fuzzyMatch(value, PROVINCIAS_ARGENTINA)
    if (match) value = match
    else skip('provincia no reconocida')
  }
}
```

#### Detección de PII sensible
```javascript
// No almacenar datos que podrían ser sensibles
const SENSITIVE_PATTERNS = [
  /\b\d{7,8}\b/,          // DNI argentino
  /\bCBU\b/i,              // datos bancarios
  /\bclave\b/i,            // contraseñas
  /\bcontraseña\b/i,
]
```

#### Validación de edad
```javascript
if (dataName === 'rango_edad') {
  const validRanges = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+']
  if (!validRanges.includes(value)) skip('rango de edad inválido')
}
```

---

## 7. Plan de implementación

### Fase A — Rápida (1-2 días)

| # | Tarea | Componente | Esfuerzo |
|---|-------|------------|----------|
| A1 | Crear endpoint `person_context` en `crm-api` | Edge Function | 2h |
| A2 | Agregar campo `nombre_preferido` al prompt de `enrich-persons` | Edge Function | 1h |
| A3 | Frontend: mostrar `contact_username` en Conversations | Frontend | 2h |
| A4 | Frontend: mostrar `contact_username` en People | Frontend | 1h |

### Fase B — Media (3-5 días)

| # | Tarea | Componente | Esfuerzo |
|---|-------|------------|----------|
| B1 | Agregar módulo Graph API a escenarios Instagram en Make.com | Make.com | 3h |
| B2 | Cambiar escenarios IG a usar `process_incoming_message` 7-params | Make.com | 2h |
| B3 | Inyectar `person_context` en escenario 4132827 (AI Agent) | Make.com | 2h |
| B4 | Migración DB: agregar `source`, `confidence`, `superseded_by`, `is_current` a `person_soft_data` | Supabase | 1h |
| B5 | Modificar `enrich-persons` para soportar actualizaciones (insert-only → upsert) | Edge Function | 4h |
| B6 | Fix race condition en `enrich-persons` (duplicados persona #9269) | Edge Function | 2h |

### Fase C — Completa (1-2 semanas)

| # | Tarea | Componente | Esfuerzo |
|---|-------|------------|----------|
| C1 | Implementar extracción incremental post-conversación (Opción B) | Make.com + EF | 8h |
| C2 | Migración batch de usernames Instagram (1,250 IGSIDs) | Edge Function | 4h |
| C3 | Mejorar validaciones de datos en `enrich-persons` | Edge Function | 4h |
| C4 | Dashboard: métricas de completitud de datos de personas | Frontend | 4h |
| C5 | Backfill: re-enriquecer personas con datos incompletos usando modelo actualizable | Edge Function | 4h |

### Dependencias

```
A1 ──→ B3 (person_context necesario antes de inyectar en IA)
A3 ──→ B1 (mostrar username requiere que se capture primero)
B4 ──→ B5 (schema nuevo antes de cambiar lógica)
B1 ──→ C2 (Graph API configurado antes de migración batch)
B5 ──→ C1 (upsert antes de extracción incremental)
B5 ──→ C5 (upsert antes de backfill)
```

---

## 8. Métricas de éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Personas con `nombre_contacto` | 9,768 (38.5%) | >80% |
| Personas IG con username | 0 (0%) | >70% |
| Personas IG con `first_name` | 295 (23.6%) | >60% |
| Datos que la IA conoce al responder | 0 campos | Todos los disponibles |
| Datos actualizados vs obsoletos | 0% actualizable | 100% actualizable |
| Personas con `nombre_preferido` | 0 | >5% (quienes lo expresan) |

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Graph API no retorna username para cuentas privadas | Alta | Medio | Usar `name` como fallback; aceptar que algunos quedarán sin username |
| Extracción incremental genera datos incorrectos | Media | Alto | Validación estricta + campo `confidence` + revisión manual de los primeros 100 |
| Costo de API aumenta significativamente | Baja | Bajo | gpt-4o-mini cuesta ~USD 0.15/1M tokens; a nuestro volumen el costo adicional es < USD 1/semana |
| Race condition en upsert concurrente | Media | Medio | Advisory lock por person_id o constraint UNIQUE + ON CONFLICT |
| La IA revela datos del perfil innecesariamente | Media | Alto | Instrucción explícita en system prompt: "NUNCA reveles que tenés esta información" |

---

## 10. Archivos a modificar (resumen)

| Archivo/Componente | Tipo de cambio |
|--------------------|-----------------|
| Edge Function `crm-api` | Nuevo endpoint `person_context` |
| Edge Function `enrich-persons` | Agregar `nombre_preferido`, cambiar insert-only → upsert, fix race condition |
| Supabase DB (migración) | Agregar columnas a `person_soft_data` (`source`, `confidence`, `superseded_by`, `is_current`) |
| Make.com: escenarios Instagram | Agregar módulo Graph API, usar 7-param RPC |
| Make.com: escenario 4132827 | Agregar módulo HTTP para `person_context` antes del AI Agent |
| `src/pages/Conversations.jsx` | Mostrar `@username` para Instagram |
| `src/pages/People.jsx` | Mostrar `@username` en perfil |
| System prompt de Ana | Agregar instrucciones de uso de contexto de persona |
