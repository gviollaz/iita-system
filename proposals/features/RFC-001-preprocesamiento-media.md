# RFC-001: Mejorar preprocesamiento de imagenes y archivos adjuntos

- **Fecha de creacion:** 2026-02-20
- **Ultima actualizacion:** 2026-02-20
- **Estado:** en_discusion
- **Prioridad:** P1
- **Autor original:** gviollaz + Claude Opus 4.6 (Claude Code)
- **Componentes afectados:** Make.com, Supabase DB, Edge Functions
- **Ref FEAT:** FEAT-014 (parcialmente), relacionado con Propuesta #1 en PROPUESTAS-PENDIENTES.md
- **Ref Roadmap:** Fase 6 (Funcionalidades Nuevas)

---

## Resumen ejecutivo

Cuando un usuario envia una imagen, audio, video o documento por WhatsApp/Instagram, la IA que genera respuestas no tiene acceso al contenido de esa media. Solo ve el texto del mensaje. Esto limita severamente la calidad de las respuestas y hace que la IA ignore preguntas que vienen como imagen (por ejemplo, una foto de un formulario, un comprobante de pago, o una captura de pantalla).

## Problema

### Situacion actual

1. Un usuario envia una imagen con texto "mira esto" por WhatsApp.
2. Make.com recibe el mensaje y almacena la referencia de media en `interaction_medias` + `medias`.
3. El escenario de generacion IA (Etapa 4) **solo pasa el texto** al modelo de IA.
4. La IA responde basandose solo en "mira esto", sin saber que hay una imagen adjunta.
5. La respuesta es generica e inutil: "Podrias darme mas informacion?"

### Datos de produccion

- **102K interacciones** en total.
- Estimacion: ~15-20% de los mensajes entrantes incluyen media adjunta (imagenes, audios, PDFs, etc.).
- **53 registros** en tabla `medias` (solo se almacenan algunos, no todos).
- El escenario 4105815 (media analysis) existe pero **apunta a la DB de desarrollo** — no funciona en produccion (BUG-004).
- La media se almacena como **base64** en `medias.content_dir`, consumiendo 654+ MB (tema aparte, ver FEAT-017).

### Tipos de media recibidos

| Canal | Tipos comunes | Notas |
|-------|--------------|-------|
| WhatsApp Cloud API | image, audio, video, document, sticker | Requiere descargar de Meta API con token |
| WhatsApp Coexistence | image, audio, video, document, sticker | Media viene como URL directa |
| Instagram | image, story_reply, story_mention | Imagenes en respuestas a stories frecuentes |
| Messenger | image, video, file, audio | MIME types a veces no estandar |

## Solucion propuesta

Implementar en 3 niveles progresivos (se puede implementar un nivel a la vez):

### Nivel 1: Contexto basico de media (rapido, bajo costo)

Agregar al prompt de la IA una indicacion de que hay media adjunta, **sin analizar el contenido**.

**Cambio en Make.com (Etapa 4 - Generacion):**
```
Contexto del prompt:
"El usuario envio un mensaje con una {tipo_media} adjunta ({mime_type}).
Tene en cuenta que hay contenido visual/auditivo que no podes ver.
Si la pregunta parece referirse a la media adjunta, pedi que describan lo que necesitan."
```

- **Pros:** Implementacion rapida (solo cambiar prompt), costo cero extra.
- **Contras:** La IA sigue sin ver el contenido, solo sabe que existe.
- **Esfuerzo:** Bajo (1-2 horas)
- **Impacto:** Medio — la IA deja de ignorar la media y al menos pide aclaracion.

### Nivel 2: Analisis previo de media (vision + transcripcion)

Usar un servicio externo para generar una **descripcion textual** de la media antes de pasarla al generador de respuestas.

**Pipeline propuesto:**
```
Mensaje con imagen → Descargar media → Analizar con Vision API → Descripcion textual → Prompt + descripcion → Respuesta IA
```

**Servicios posibles:**
| Tipo media | Servicio | Costo estimado |
|------------|---------|----------------|
| Imagenes | Claude Vision (claude-3-haiku) o GPT-4o-mini | ~$0.001-0.003/imagen |
| Audio | OpenAI Whisper o Deepgram | ~$0.006/minuto |
| Video | Extraer frames + Vision API | ~$0.01-0.05/video |
| Documentos/PDF | Extraer texto (OCR si necesario) | ~$0.001-0.01/doc |

**Cambio en Make.com (nueva Etapa 3.5 o mejorar Etapa 3):**
1. Descargar media desde la URL del proveedor.
2. Enviar a servicio de analisis segun tipo.
3. Guardar descripcion en nuevo campo `media_description` en `interactions` o `medias`.
4. Incluir la descripcion en el prompt de Etapa 4.

- **Pros:** La IA tiene contexto real del contenido de la media. Funciona con cualquier modelo de texto.
- **Contras:** Aumenta costos por mensaje (~$0.003-0.05 extra por media). Agrega latencia (2-5 seg).
- **Esfuerzo:** Medio (1-2 semanas)
- **Impacto:** Alto — respuestas mucho mas contextualizadas.

### Nivel 3: Multimodal nativo (mejor calidad)

Enviar la media directamente al modelo multimodal (Claude 3.5+, GPT-4o) junto con el texto.

- **Pros:** Maxima calidad, el modelo ve la media original.
- **Contras:** Solo funciona con modelos multimodales. Costo mas alto. Requiere cambio en la API de generacion.
- **Esfuerzo:** Medio-Alto (2-3 semanas)
- **Impacto:** Critico — soporte nativo multimodal.

## Diseno tecnico

### Cambios en base de datos

```sql
-- Opcion: agregar campo de descripcion de media
ALTER TABLE medias ADD COLUMN ai_description TEXT;
ALTER TABLE medias ADD COLUMN ai_description_model TEXT; -- modelo que genero la descripcion
ALTER TABLE medias ADD COLUMN ai_description_at TIMESTAMPTZ;

-- O alternativamente, agregar a interactions
ALTER TABLE interactions ADD COLUMN media_context TEXT; -- resumen de toda la media adjunta
```

### Cambios en Make.com

**Escenario a modificar o crear:**
- Escenario 4105815 (media analysis) — actualmente apuntando a DB dev. Corregir y reactivar.
- O crear nuevo escenario "Media Preprocessing" en Etapa 3.

**Modulos necesarios:**
1. Trigger: cuando una interaccion tiene media adjunta.
2. Descargar media (HTTP module con URL del proveedor).
3. Analizar segun tipo (router: imagen → Vision API, audio → Whisper, etc.).
4. Guardar descripcion en DB.
5. Notificar a Etapa 4 que el preprocesamiento esta listo.

### Cambios en Edge Functions

```typescript
// En crm-api, exponer la descripcion de media en get_chat_detail
// para que el frontend muestre el analisis junto al mensaje
```

### Cambios en frontend

```jsx
// En Conversations.jsx, mostrar badge o tooltip con el analisis de media
// "🤖 Analisis: Foto de un comprobante de pago de $15,000 a nombre de Juan Perez"
```

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | Implementar Nivel 1 (contexto basico en prompt) | Make.com | 2 horas |
| 2 | Corregir escenario 4105815 (apuntar a DB prod) | Make.com | 1 hora |
| 3 | Implementar descarga de media por proveedor | Make.com | 1 dia |
| 4 | Integrar Vision API para imagenes | Make.com | 1 dia |
| 5 | Agregar campo `ai_description` a tabla `medias` | Supabase DB | 30 min |
| 6 | Incluir descripcion en prompt de generacion IA | Make.com | 2 horas |
| 7 | Mostrar analisis de media en frontend | Frontend | 1 dia |
| 8 | (Futuro) Integrar Whisper para audio | Make.com | 1 dia |
| 9 | (Futuro) Nivel 3 multimodal nativo | Make.com | 2-3 dias |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Aumento de costos API por analisis de media | Medio | Empezar con Nivel 1 (costo cero). Nivel 2 solo para imagenes inicialmente. |
| Latencia adicional en respuesta IA | Bajo | El preprocesamiento puede ser asincrono (la IA espera) |
| Media muy grande (video largo, PDF pesado) | Medio | Limitar tamano maximo. Para video, analizar solo primer frame. |
| Falla del servicio de vision/transcripcion | Bajo | Fallback al Nivel 1 (solo indicar que hay media adjunta) |
| Contenido sensible en media (datos personales, documentos) | Alto | No almacenar la media completa en el prompt, solo la descripcion |

## Criterios de aceptacion

- [ ] Nivel 1: La IA menciona la media adjunta en su respuesta cuando hay media
- [ ] Nivel 2: Las imagenes se analizan y la descripcion se incluye en el prompt
- [ ] La descripcion de media se almacena en la DB para trazabilidad
- [ ] El frontend muestra el analisis de media junto al mensaje
- [ ] Los costos adicionales estan dentro del presupuesto definido

## Dependencias

- **Requiere:** Fix de BUG-004 (escenario media analysis apunta a DB dev)
- **Requiere:** FEAT-017 (migracion de media a Storage) seria ideal pero no bloqueante
- **Bloquea:** Nada directamente, pero mejora significativamente la calidad de FEAT-014 (evaluacion IA)

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### 2026-02-20 - Claude Opus 4.6 (Claude Code)

Contexto inicial: Ya existe la Propuesta #1 en PROPUESTAS-PENDIENTES.md con los 3 niveles. Este RFC la expande con detalles tecnicos, costos estimados y plan de implementacion.

Recomendacion: Implementar Nivel 1 inmediatamente (es gratis y se hace en 2 horas). Luego evaluar presupuesto para Nivel 2 con imagenes, que es donde se ve el mayor impacto por costo.

Pregunta abierta: Para el Nivel 2, usar Claude Vision (haiku) o GPT-4o-mini para el analisis de imagenes? Claude haiku es mas barato pero GPT-4o-mini tiene mejor soporte de OCR.

### 2026-02-20 - gviollaz

Propuesta creada a partir de necesidad detectada en operacion diaria. Los operadores frecuentemente reciben imagenes de comprobantes de pago y la IA no puede ayudar. Priorizar las imagenes sobre audio/video.

### 2026-02-20 - Gemini CLI 2.0

**Analisis de Experto:**
1. **Dependencia Critica:** El Nivel 2 (Analisis) depende fuertemente de **FEAT-017 (Storage)**. Enviar base64 a APIs de Vision es ineficiente. Recomiendo implementar signed URLs de Supabase Storage para el proceso de analisis.
2. **Optimizacion de Prompt:** En lugar de solo `ai_description`, propongo un campo `media_summary` en la tabla `interactions` que consolide el analisis de todas las piezas de media de ese mensaje. Esto simplifica la consulta para el motor de generacion (Etapa 4).
3. **Seleccion de Modelo:** Para el Nivel 2, recomiendo **gemini-1.5-flash** o **gpt-4o-mini** por su bajisima latencia y costo, permitiendo que el preprocesamiento sea casi imperceptible para el usuario final.
4. **Validacion de Negocio:** El analisis debe detectar especificamente "Comprobantes de Pago", "DNI/Documentos" y "Capturas de Error", ya que son los casos de uso con mayor valor para los operadores de IITA.

**DECISION SUGERIDA:** Proceder con Nivel 1 inmediatamente. Iniciar FEAT-017 como bloqueante para Nivel 2.

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-02-20 | Claude Opus 4.6 | Creacion del RFC a partir de Propuesta #1 existente |
| 2026-02-20 | gviollaz | Solicitud de creacion con contexto de negocio |
