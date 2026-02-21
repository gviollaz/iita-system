# IITA CRM — Propuestas pendientes de implementaci&oacute;n

> **Fecha:** 2026-02-20
> **Estado:** Analizadas, NO implementadas. Requieren revisi&oacute;n y aprobaci&oacute;n antes de aplicar.

---

## 1. Mejora del manejo de media/adjuntos en la generaci&oacute;n de respuestas IA

### Contexto del problema

Cuando un cliente env&iacute;a una imagen (ej: screenshot de una publicidad, un meme, una captura de redes sociales), el pipeline actual genera respuestas inapropiadas porque:

1. **GPT-5.2 describe la imagen en abstracto** (escenario Make.com 4132732) sin saber que viene de un CRM educativo
2. **La descripci&oacute;n se inyecta cruda** en el contexto de conversaci&oacute;n (escenario 4132827)
3. **El system prompt de "Ana" no tiene reglas para media** — no sabe qu&eacute; hacer con im&aacute;genes off-topic

**Caso real:** Conversaci&oacute;n 1824550928228105 — Cliente envi&oacute; screenshot de un posteo de Elon Musk sobre crypto/casino. La IA gener&oacute; una advertencia de phishing en vez de responder como vendedora de cursos.

### Propuesta: 3 niveles

#### Nivel 1 — Reglas de media en system prompt (RECOMENDADO PRIMERO)

**Qu&eacute;:** Agregar secci&oacute;n al system prompt del AI Agent (escenario Make.com 4132827, m&oacute;dulo 7).

**D&oacute;nde:** Campo `system_prompt` del m&oacute;dulo InsertIntoTable que inserta en `ai_interaction`.

**Texto a agregar:**
```
## Manejo de im&aacute;genes y archivos adjuntos

Cuando el historial incluya [media del mensaje], segu&iacute; estas reglas:

1. COMPROBANTE DE PAGO: Si la descripci&oacute;n indica un comprobante, transferencia, 
   recibo o captura de operaci&oacute;n bancaria → Agradec&eacute; la recepci&oacute;n, confirm&aacute; que 
   lo revisar&aacute;n, y extra&eacute; los datos visibles (monto, fecha, referencia).

2. PUBLICIDAD O PROMOCI&Oacute;N COMPARTIDA: Si la descripci&oacute;n muestra una publicidad, 
   flyer, posteo de redes sociales, o captura de pantalla de una oferta/curso 
   → Interpretalo como que el contacto est&aacute; interesado en esa tem&aacute;tica. 
   Pregunt&aacute; si le interesa un curso relacionado en IITA. 
   NUNCA analices el contenido externo ni opines sobre su veracidad.

3. CONTENIDO OFF-TOPIC: Si la imagen muestra contenido no relacionado con 
   educaci&oacute;n ni pagos (memes, noticias, criptomonedas, pol&iacute;tica, etc.) 
   → Ignor&aacute; el contenido de la imagen. Respond&eacute; amablemente preguntando 
   "¿En qu&eacute; puedo ayudarte respecto a nuestros cursos?" 
   NUNCA des opiniones, advertencias ni an&aacute;lisis sobre contenido externo.

4. IMAGEN NO ANALIZABLE: Si dice "no es posible analizar la media" 
   → Respond&eacute; con naturalidad preguntando qu&eacute; necesita el contacto.

5. FOTO PERSONAL O SELFIE: Si la descripci&oacute;n indica una foto de persona 
   → Ignorala y continu&aacute; la conversaci&oacute;n normalmente.

REGLA DE ORO: Vos sos vendedora de cursos. NUNCA te salgas de ese rol 
para opinar sobre contenido externo, sin importar lo que muestre la imagen.
```

**Esfuerzo:** Bajo (editar campo de texto en Make.com)
**Impacto:** Alto — resuelve el problema principal inmediatamente

#### Nivel 2 — Clasificaci&oacute;n de imagen en an&aacute;lisis

**Qu&eacute;:** Modificar el prompt de GPT-5.2 en el escenario 4132732 (m&oacute;dulo 9, analyzeImages) para que clasifique la imagen.

**Texto a agregar al inicio del prompt existente:**
```
CONTEXTO IMPORTANTE: Esta imagen fue enviada por un cliente potencial a un 
instituto educativo (IITA - cursos de tecnolog&iacute;a, programaci&oacute;n, marketing, etc.) 
a trav&eacute;s de un canal de mensajer&iacute;a (WhatsApp/Instagram).

Antes de la descripci&oacute;n, clasific&aacute; la imagen en una de estas categor&iacute;as 
escribiendo la l&iacute;nea exacta:

CLASIFICACION: COMPROBANTE — si es un recibo, transferencia, comprobante de pago
CLASIFICACION: PUBLICIDAD — si es un flyer, anuncio, captura de red social, 
  promoci&oacute;n, o imagen compartida de una oferta/curso
CLASIFICACION: DOCUMENTO — si es un documento formal, certificado, DNI, constancia
CLASIFICACION: CONVERSACIONAL — si es una foto personal, selfie, imagen casual
CLASIFICACION: OTRO — si no encaja en ninguna categor&iacute;a anterior

Luego continu&aacute; con la descripci&oacute;n seg&uacute;n las reglas existentes.
```

**Esfuerzo:** Medio
**Impacto:** Medio — mejora la precisi&oacute;n de clasificaci&oacute;n para Ana

#### Nivel 3 — Re-encuadrar label de media en SQL

**Qu&eacute;:** Cambiar c&oacute;mo se presenta la media en el contexto de conversaci&oacute;n (escenario 4132827, m&oacute;dulo 4, query SQL).

**Actual:**
```sql
'    [media del mensaje]: ' || media
```

**Propuesto:**
```sql
'    [El contacto envi&oacute; una imagen/archivo adjunto. Descripci&oacute;n autom&aacute;tica]: ' || media
```

**Esfuerzo:** Bajo
**Impacto:** Bajo — complementario

### Recomendaci&oacute;n

Aplicar Nivel 1 primero y evaluar resultados. Si persisten problemas, agregar Nivel 2. Nivel 3 como complemento opcional.

---

## 2. Cancelaci&oacute;n autom&aacute;tica de respuesta IA cuando un humano responde

### Contexto

Los operadores humanos a veces responden mensajes de clientes desde Instagram/Meta Business Suite en paralelo al sistema IA. Cuando eso pasa:
- La respuesta humana se guarda correctamente en la DB (el trigger anti-eco la deja pasar)
- Pero la respuesta IA sigue como `pending`, esperando aprobaci&oacute;n
- El operador del CRM puede aprobar la IA sin saber que ya se respondi&oacute; manualmente

### Propuesta

Crear una funci&oacute;n RPC `handle_human_response` que:

1. Detecte si hay una respuesta IA `pending` para la misma conversaci&oacute;n
2. Si existe, la marque como `superseded` (nuevo estado) o `conflictive`
3. Opcionalmente, regenere la respuesta IA con el nuevo contexto (incluyendo la respuesta humana)

**Trigger sugerido:** En el INSERT de interacciones entrantes (desde operadores humanos), verificar si hay `ai_interaction.evaluation = 'pending'` para la misma conversaci&oacute;n y cambiarla autom&aacute;ticamente.

**Esfuerzo:** Medio
**Impacto:** Alto — evita respuestas duplicadas y mejora flujo de trabajo

---

## 3. Normalizaci&oacute;n de tipos de media de Messenger

### Problema

Make.com guarda el MIME type completo como `medias.type` para adjuntos de Messenger:
- `html; charset="utf-8"` en vez de `html`
- Esto causa que `isImage()` y `isVideo()` del frontend no los reconozcan

### Registros afectados

~6 registros con tipos MIME completos (IDs 44, 45, 48, 49 y similares).

### Propuesta

1. **En Make.com (escenario 4132732):** Normalizar `content-type` antes de guardar, extrayendo solo la extensi&oacute;n
2. **En la RPC `get_chat_detail`:** Agregar l&oacute;gica de normalizaci&oacute;n: `SPLIT_PART(med.type, ';', 1)` 
3. **Limpiar datos existentes:**
```sql
UPDATE medias SET type = 'html' WHERE type LIKE 'html;%';
```

**Esfuerzo:** Bajo
**Impacto:** Bajo (pocos registros afectados)

---

## 4. Seguridad: Habilitar JWT en Edge Functions

> **Referencia:** Plan de trabajo Fase 1, tareas 1.1-1.4 en CLAUDE.md

### Problema actual

Las 3 Edge Functions (`crm-api`, `courses-crud`, `create-test-user`) tienen `verify_jwt: false`. Cualquier persona con la URL puede acceder a TODOS los datos (25K+ personas, 102K interacciones).

### Pasos propuestos

1. Implementar login en el CRM con Supabase Auth (Frontend)
2. Enviar token JWT en cada request del frontend
3. Habilitar `verify_jwt: true` en las Edge Functions
4. Restringir CORS a dominios conocidos

**IMPORTANTE:** Los pasos 1-2 deben ir ANTES del 3, o el CRM dejar&aacute; de funcionar.

**Esfuerzo:** Alto (1-2 semanas)
**Impacto:** Cr&iacute;tico — actualmente los datos est&aacute;n expuestos

---

## ~~5. Fix search_path en funciones PostgreSQL~~ ✅ IMPLEMENTADA

> **Implementada el:** 20-feb-2026
> **Migracion:** `fix_search_path_16_functions`

Se aplico `SET search_path = public` a las 16 funciones restantes. Resultado: **0 advisories** de `function_search_path_mutable`. Ver detalle completo en CHANGELOG.md.

**29/29 funciones publicas tienen search_path fijado.**

---

## 6. Limpieza de 107 interacciones duplicadas con dependencias

### Contexto

De la limpieza de ecos del 20-feb, quedaron 107 interacciones duplicadas que tienen `ai_interaction` o `interaction_medias` asociadas. No se eliminaron para no perder datos.

### Propuesta

Para cada grupo de duplicados:
1. Identificar cu&aacute;l es el "original" (el de menor ID o el que tiene status m&aacute;s avanzado)
2. Reasignar las dependencias (`ai_interaction.associated_interaction_id`, `interaction_medias.interaction_id`) al original
3. Eliminar el duplicado

```sql
-- Query de an&aacute;lisis para revisar caso por caso
SELECT i.id, i.external_ref, i.status, i.time_stamp,
       ai.id as ai_id, ai.evaluation,
       COUNT(im.id) as media_count
FROM interactions i
LEFT JOIN ai_interaction ai ON ai.associated_interaction_id = i.id
LEFT JOIN interaction_medias im ON im.interaction_id = i.id
WHERE i.external_ref IN (
  SELECT external_ref FROM interactions 
  WHERE LENGTH(external_ref) > 10
  GROUP BY external_ref HAVING COUNT(*) > 1
)
GROUP BY i.id, i.external_ref, i.status, i.time_stamp, ai.id, ai.evaluation
ORDER BY i.external_ref, i.id;
```

**Esfuerzo:** Medio (requiere an&aacute;lisis manual por grupo)
**Impacto:** Bajo (limpieza de datos)

---

## Pipeline de escenarios Make.com analizados

### Escenario 4132827 — Generaci&oacute;n de respuesta IA

**Flujo:** Webhook trigger → Filter (status=preprocessed, id_person_conversation exists) → Sleep 1min → PostgreSQL query (contexto conv.) → Filter (check last msg) → AI Agent → Insert ai_interaction

**Agent IA:** ID `d5568d5f-072d-410a-8c60-2cc48e944525`, nombre "Atenci&oacute;n al cliente y asesor de cursos"

**System prompt:** Rol "Ana", vendedora de cursos IITA. Incluye reglas de persuasi&oacute;n, precios, inscripci&oacute;n, CBU, l&iacute;mite 800 chars. **NO incluye reglas para media** (propuesta Nivel 1).

### Escenario 4132732 — An&aacute;lisis de media (preprocesamiento)

**Flujo:** Webhook → Filter (status=new) → Sleep 10s → Query media → Router → Branch by type

| Tipo | Modelo | Output template |
|------|--------|-----------------|
| Imagen | OpenAI GPT-5.2 (analyzeImages) | `Analisis de la imagen:\n{result}` |
| Audio | gpt-4o-mini-transcribe | `Contenido del audio:\n{text}` |
| Documento | GPT-5.2 (createModelResponse) | `Contenido del Archivo:\n{result}` |
| No soportado | N/A | `Actualmente no es posible analizar la media...\nTipo de media: {content-type}` |

**Prompt de imagen actual:** Describe sin contexto CRM. Enfocado en comprobantes de pago y descripci&oacute;n general. **No clasifica la imagen** (propuesta Nivel 2).

---

## Resumen de prioridades (actualizado 20-feb-2026)

| # | Propuesta | Esfuerzo | Impacto | Estado |
|---|-----------|----------|---------|--------|
| 5 | ~~Fix search_path funciones~~ | ~~Bajo~~ | ~~Medio~~ | ✅ **IMPLEMENTADA** |
| 1 | Reglas media en system prompt (Nivel 1) | Bajo | Alto | 🔧 Texto validado con datos (29.5% rechazo), prompt completo en `SYSTEM-PROMPT-ANA-COMPLETO.md`, pendiente aplicar en Make.com AI Agent |
| 4 | JWT en Edge Functions | Alto | Critico | ⏳ Requiere login frontend primero |
| 2 | Cancelar IA cuando humano responde | Medio | Alto | ⏳ Diseño listo |
| 1 | Clasificacion de imagen (Nivel 2) | Medio | Medio | ⏳ Pendiente |
| 3 | Normalizar tipos media Messenger | Bajo | Bajo | ⏳ Pendiente |
| 6 | Limpiar 107 duplicados con deps | Medio | Bajo | ⏳ Pendiente |
| 1 | Re-encuadrar label media (Nivel 3) | Bajo | Bajo | ⏳ Pendiente |

### Siguiente paso recomendado

**Propuesta 1 Nivel 1** (reglas de media en system prompt): Texto completo listo en `SYSTEM-PROMPT-ANA-COMPLETO.md`. Aplicar en Make.com → AI Agents → "Atencion al cliente y asesor de cursos (Activo)". Luego actualizar copia hardcodeada en escenario 4132827 modulo 7.

### Bugs corregidos en esta sesion (20-feb-2026 noche)

| Bug | Fix | Estado |
|-----|-----|--------|
| Race condition en trigger de ecos (23 duplicados nuevos) | Migracion `fix_echo_trigger_race_condition`: Guard 2 ampliado a `IN ('send','pending_delivery','sending')` | ✅ Aplicado en DB |
| Respuestas IA truncadas a 400 chars en panel de aprobacion | `Conversations.jsx`: eliminado `.slice(0,400)` | ✅ Codigo corregido, pendiente `npm run build` |
