# Implementacion: Reglas de media en system prompt de Ana

**Fecha:** 20-feb-2026
**Propuesta:** #1 Nivel 1 (PROPUESTAS-PENDIENTES.md)
**Riesgo:** Bajo | **Impacto:** Alto | **Esfuerzo:** 5 minutos
**Validado con datos:** Tasa de rechazo 29.5% en respuestas con media vs 0.5% sin media

---

## Donde hacer el cambio

**Make.com → AI Agents → "Atencion al cliente y asesor de cursos (Activo)"**
Agent ID: `d5568d5f-072d-410a-8c60-2cc48e944525`

El system prompt de Ana se edita **dentro de la configuracion del AI Agent** en Make.com (no en el escenario directamente).

Despues de editar el agente, tambien actualizar la copia hardcodeada en:
**Escenario 4132827** ("RG Generate AI Response - Prod") → **Modulo 7** (InsertIntoTable) → campo `system_prompt`

---

## Instrucciones paso a paso

### 1. Backup (30 segundos)

Antes de editar, copiar el system prompt actual completo a un archivo de texto como respaldo.
El prompt vigente es el que empieza con:
```
## Rol y objetivo
Tu nombre es **Ana** y sos asesora de cursos de **IITA...
```
Y termina con:
```
No pegues temarios largos si no los piden: ofrecé resumen + opción de detalle.
```

### 2. Ubicar el punto de insercion

Buscar la seccion:
```
## Alcance y links
- Solo información de **cursos IITA**. No rompas personaje.
- **Links:** evitarlos; ...
```

Insertar la nueva seccion **DESPUES** de "Alcance y links" y **ANTES** de "Oferta académica y disponibilidad".

### 3. Texto a insertar

Copiar y pegar el bloque completo de la seccion "Texto para copiar-pegar" de abajo.

### 4. Verificar

Despues de guardar:
1. Probar con un mensaje que incluya una imagen off-topic (meme, screenshot de red social)
2. Probar con un audio de consulta
3. Verificar que respuestas normales (sin media) siguen funcionando igual

---

## Texto para copiar-pegar

Copiar desde aqui:

---BEGIN---

---
## Manejo de imagenes, archivos y audios adjuntos
Cuando en el historial de conversacion aparezca `[media del mensaje]` seguido de una descripcion, o `Contenido del audio:` seguido de texto, segui estas reglas:

**1. Comprobante de pago o transferencia**
Si la descripcion indica un comprobante, transferencia bancaria, captura de operacion bancaria o confirmacion de pago → Agradece el envio, confirma que sera revisado y extrae los datos visibles (monto, fecha, numero de referencia, destinatario). Luego continua con el proceso de inscripcion.

**2. Publicidad o promocion compartida**
Si la descripcion muestra un anuncio, flyer, post de redes sociales, captura de una oferta de curso o promocion educativa → Interpreta que el contacto esta interesado en esa tematica. Pregunta si le interesa un curso relacionado en IITA. **NUNCA** analices el contenido externo ni opines sobre su legitimidad.

**3. Contenido fuera de tema**
Si la imagen muestra contenido no relacionado con educacion ni pagos (memes, noticias, criptomonedas, politica, apuestas, celebridades, etc.) → Ignora el contenido de la imagen. Responde amablemente: "¿En que puedo ayudarte respecto a nuestros cursos?" **NUNCA** des opiniones, advertencias ni analisis sobre contenido externo.

**4. Media no analizable**
Si dice "no es posible analizar la media" o "Tipo de media: video/mp4" → Responde naturalmente preguntando que necesita. Ejemplo: "Me llego un archivo pero no puedo visualizarlo. ¿Me contas que querias consultar?"

**5. Foto personal o selfie**
Si la descripcion indica una foto de una persona → Ignorala y continua la conversacion normalmente.

**6. Audio transcrito**
Si el historial incluye "Contenido del audio:" seguido de texto → Trata ese texto **COMO SI** el contacto lo hubiera escrito directamente. Responde al contenido del audio, no al hecho de que fue un audio.

**REGLA DE ORO:** Sos vendedora de cursos. **NUNCA** rompas personaje para comentar, analizar, advertir u opinar sobre contenido externo, sin importar lo que muestre la imagen o el archivo.

---END---

---

## Donde queda en el prompt

El prompt completo con la seccion insertada queda asi:

```
...
## Alcance y links
- Solo información de **cursos IITA**. No rompas personaje.
- **Links:** evitarlos; ...

---                                          ← NUEVA SECCION
## Manejo de imagenes, archivos y audios adjuntos
Cuando en el historial de conversacion aparezca...
(todo el bloque de arriba)
...sin importar lo que muestre la imagen o el archivo.

---
## Oferta académica y disponibilidad (obligatorio antes de proponer/inscribir)
Los cursos pueden estar cerrados...
...
```

---

## Diferencias con la propuesta original

| Aspecto | Propuesta original | Version final | Razon |
|---------|-------------------|---------------|-------|
| Idioma | No especificado | **Espanol** | El prompt vigente esta 100% en espanol |
| Regla 6 (audio) | No existia | **Agregada** | Audios tienen 71% de rechazo, era un gap critico |
| Estilo | Generico | **Adaptado** al formato del prompt (markdown, negritas, `codigo`) | Consistencia visual |
| Ubicacion | Antes de "Operational workflows" | **Despues de "Alcance y links"** | Es la seccion de scope/contenido en el prompt actual |
| Referencia a "transfer receipt image" | Se actualizaba | **No aplica** | Esa linea no existe en el prompt actual (era de la version vieja en ingles) |

---

## Validacion post-implementacion

### Metrica de exito
Monitorear la tasa de rechazo en respuestas con media durante 1 semana:

```sql
-- Ejecutar en Supabase SQL Editor despues de 1 semana
SELECT
  ai.evaluation,
  count(*) as cnt,
  ROUND(100.0 * count(*) / SUM(count(*)) OVER(), 1) as pct
FROM interaction_medias im
JOIN ai_interaction ai ON ai.associated_interaction_id = im.interaction_id
WHERE ai.id > 12360  -- Solo respuestas posteriores al cambio
GROUP BY ai.evaluation
ORDER BY cnt DESC;
```

**Objetivo:** Tasa de rechazo en media < 10% (actualmente 29.5%)

### Casos de prueba sugeridos
1. Enviar screenshot de publicidad de Instagram → Deberia preguntar por cursos relacionados
2. Enviar un meme → Deberia preguntar "¿En que puedo ayudarte respecto a nuestros cursos?"
3. Enviar un comprobante de pago → Deberia agradecer y extraer datos
4. Enviar un video → Deberia pedir que describa lo que queria consultar
5. Enviar un audio consultando por Python → Deberia responder sobre el curso de Python

---

## Rollback

Si algo sale mal, simplemente eliminar la seccion "## Manejo de imagenes, archivos y audios adjuntos" completa del prompt del AI Agent. No hay otros cambios que revertir.
