# An&aacute;lisis de escenarios Make.com — Pipeline IA

> **Fecha:** 2026-02-20
> **Autor:** An&aacute;lisis autom&aacute;tico con Claude
> **Estado:** Documentaci&oacute;n + propuestas (sin cambios aplicados)

---

## Escenarios analizados

### 1. Escenario 4132827 — `rg_generate_ai_response_-_prod`

**Etapa:** 4_generacion
**Funci&oacute;n:** Genera respuesta IA para mensajes entrantes de clientes

#### Flujo

```
[Supabase Webhook]
  (trigger: INSERT en interactions)
    &darr;
[Filter] status = 'preprocessed' AND id_person_conversation IS NOT NULL
    &darr;
[Sleep 1 min] (espera a que media analysis termine)
    &darr;
[PostgreSQL Query] Construye contexto de conversaci&oacute;n (&uacute;ltimas 10 interacciones)
    &darr;
[Filter] Verifica que hay mensajes sin responder
    &darr;
[AI Agent] Genera respuesta
  Agent ID: d5568d5f-072d-410a-8c60-2cc48e944525
  Nombre: "Atenci&oacute;n al cliente y asesor de cursos (Activo)"
    &darr;
[Insert ai_interaction] Guarda respuesta con evaluation='pending'
```

#### Query SQL de contexto (M&oacute;dulo 4)

La query construye dos textos:
- `conversation_text`: Historial completo (hasta el &uacute;ltimo mensaje del sistema)
- `unanswered_text`: Mensajes sin responder (despu&eacute;s del &uacute;ltimo mensaje del sistema)

**C&oacute;mo incluye media:**
```sql
'    [texto del mensaje]: ' || coalesce(text, '[sin texto]') ||
case when media is null then ''
     else '    [media del mensaje]: ' || media
end
```

Donde `media` viene de un LEFT JOIN con `interaction_medias` + `medias.description`.

#### Mensajes enviados al AI Agent

```
Mensaje 1: "Historial de conversaci&oacute;n (contexto):\n{conversation_text}"
Mensaje 2: "Ultimos mensajes (responder a esto):\n{unanswered_text}"
```

#### System prompt (resumen)

- Rol: "Ana", vendedora de cursos IITA
- Objetivo: Convertir conversaciones en inscripciones
- Reglas de persuasi&oacute;n (SPIN, objeciones, urgencia)
- Cat&aacute;logo de cursos con precios
- M&eacute;todo de pago: CBU Banco Naci&oacute;n
- L&iacute;mite: 800 caracteres por mensaje (Instagram)
- &Uacute;nica referencia a media: "Si el usuario env&iacute;a imagen de comprobante de transferencia, analiz&aacute; los datos"
- **NO tiene instrucciones para im&aacute;genes off-topic, publicidades, memes, etc.**

#### Problemas detectados

| # | Problema | Impacto |
|---|---------|---------|
| 1 | Sin reglas para media off-topic | IA genera respuestas inapropiadas (ej: advertencias de phishing) |
| 2 | Sleep fijo de 60s | Si media analysis demora m&aacute;s, el contexto no incluye la descripci&oacute;n |
| 3 | Label `[media del mensaje]` ambiguo | No distingue si el contacto envi&oacute; la imagen o si es contenido externo |

---

### 2. Escenario 4132732 — `prepross_media_analisis_-_prod`

**Etapa:** 3_preprocesamiento
**Funci&oacute;n:** Analiza archivos multimedia adjuntos a interacciones

#### Flujo

```
[Supabase Webhook]
  (trigger: INSERT en interactions)
    &darr;
[Filter] status = 'new'
    &darr;
[Sleep 10s] (espera a que el archivo se suba a Storage)
    &darr;
[PostgreSQL Query] Obtiene media_id, content_dir, content_type de interaction_medias + medias
    &darr;
[Supabase Storage] Genera signed URL (1 hora) para el archivo
    &darr;
[Router] Redirige seg&uacute;n content-type del archivo
    &darr;
┌────────────────┬─────────────────┬──────────────────┬───────────────────┐
│ Imagen         │ Audio           │ Documento        │ No soportado      │
│ (image/*)      │ (audio/*)       │ (application/*)  │ (otro)            │
├────────────────┼─────────────────┼──────────────────┼───────────────────┤
│ GPT-5.2        │ gpt-4o-mini     │ GPT-5.2          │ Fallback          │
│ analyzeImages  │ transcribe      │ createModelResp  │ mensaje est&aacute;tico │
├────────────────┼─────────────────┼──────────────────┼───────────────────┤
│ UPDATE medias  │ UPDATE medias   │ UPDATE medias    │ UPDATE medias     │
│ description=   │ description=    │ description=     │ description=      │
│ "Analisis de   │ "Contenido del  │ "Contenido del   │ "Actualmente no   │
│  la imagen:\n" │  audio:\n"      │  Archivo:\n"     │  es posible..."   │
├────────────────┴─────────────────┴──────────────────┴───────────────────┤
│ UPDATE interactions SET status = 'preprocessed'                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Prompt de an&aacute;lisis de imagen (M&oacute;dulo 9)

```
Eres un agente dedicado &uacute;nicamente a analizar im&aacute;genes. Tu tarea es observar la
imagen y devolver un &uacute;nico resultado en texto plano [...]

Reglas obligatorias:
- No inventes informaci&oacute;n.
- Si un dato no es visible, indic&aacute; que no es legible.

Siempre deb&eacute;s incluir una descripci&oacute;n al comienzo:
- Si es un comprobante de pago → descripci&oacute;n breve
- Si NO es comprobante → descripci&oacute;n detallada con toda info relevante

Si es comprobante, extra&eacute; todos los datos [...]
```

**Problema clave:** El prompt no tiene contexto CRM. Describe la imagen en abstracto, sin saber que viene de un instituto educativo. Resultado: para un screenshot de crypto scam, genera una descripci&oacute;n detallada del scam que luego "Ana" interpreta como el tema de conversaci&oacute;n.

#### Estad&iacute;sticas de media (20-feb-2026)

| M&eacute;trica | Valor |
|----------|-------|
| Total medias en DB | 57 |
| Con descripci&oacute;n | 33 |
| Sin descripci&oacute;n | 24 |
| Tipo: jpeg | ~20 |
| Tipo: mp4 | ~25 |
| Tipo: html (Messenger) | ~6 |
| Almacenamiento | Supabase Storage (bucket `media`, p&uacute;blico) |
| Formato content_dir | Path relativo: `media/interaction_medias/...` |

---

## Propuestas de mejora (sin aplicar)

### Nivel 1 — Agregar reglas de media al system prompt de Ana

**Escenario:** 4132827, m&oacute;dulo 7 (InsertIntoTable)
**Campo:** `system_prompt`

Agregar secci&oacute;n con reglas para:
1. Comprobantes de pago → agradecer y extraer datos
2. Publicidad compartida → interpretar como inter&eacute;s en cursos
3. Contenido off-topic → ignorar, redirigir a cursos
4. Media no analizable → preguntar naturalmente
5. Fotos personales → ignorar y continuar

**Texto completo en:** `iitacrm/docs/PROPUESTAS-PENDIENTES.md`, secci&oacute;n 1, Nivel 1

### Nivel 2 — Clasificaci&oacute;n de imagen en preprocesamiento

**Escenario:** 4132732, m&oacute;dulo 9 (analyzeImages)
**Campo:** Prompt de an&aacute;lisis

Agregar contexto CRM y clasificaci&oacute;n autom&aacute;tica:
- COMPROBANTE / PUBLICIDAD / DOCUMENTO / CONVERSACIONAL / OTRO

### Nivel 3 — Mejorar label de media en contexto SQL

**Escenario:** 4132827, m&oacute;dulo 4 (Query SQL)

Cambiar `[media del mensaje]` por `[El contacto envi&oacute; una imagen/archivo adjunto. Descripci&oacute;n autom&aacute;tica]`

---

## Bugs P0 pendientes en Make.com (del repo existente)

Estos bugs ya estaban documentados previamente. Se incluyen aqu&iacute; como referencia cruzada:

| # | Bug | Escenario | M&oacute;dulo |
|---|-----|-----------|--------|
| P0-1 | Caption perdido en WA Cloud API (`image.caption` hardcoded) | 4097069 | 8 |
| P0-2 | Media ID corrupto en WA Coexistence (sticker ID fuera de condici&oacute;n) | 4161348 | 6 |
| P0-3 | `video.id` extra&iacute;do en vez de `video.caption` | 4161348 | 7 |
| P0-4 | Escenario 4105815 apunta a DB de desarrollo | 4105815 | todos |

## Ecos de Instagram/WhatsApp (resuelto en DB)

### Problema

Cuando el sistema env&iacute;a una respuesta por Instagram, el webhook de la plataforma reenv&iacute;a el mismo mensaje como eco ~1 segundo despu&eacute;s. Make.com lo insertaba como nueva interacci&oacute;n `preprocessed`.

### Soluci&oacute;n aplicada (en Supabase, no en Make.com)

Se cre&oacute; un trigger `prevent_echo_interaction()` en la tabla `interactions` que bloquea:
1. Duplicados de `external_ref` (longitud > 10)
2. Ecos: texto id&eacute;ntico a un mensaje `send` en <60s en el mismo `system_conversation`

### Por qu&eacute; NO se cambi&oacute; Make.com

Se evalu&oacute; filtrar ecos en Make.com pero se opt&oacute; por el trigger DB porque:
- Es m&aacute;s confiable (capa final antes del INSERT)
- No requiere modificar m&uacute;ltiples escenarios de entrada
- Permite que respuestas humanas desde Instagram/Meta Business Suite se sigan guardando
- Las campa&ntilde;as masivas (texto id&eacute;ntico a m&uacute;ltiples leads) no se ven afectadas

### Opci&oacute;n futura: Filtro en Make.com

Si se desea reducir ejecuciones innecesarias de Make.com (ahorro de operaciones), se podr&iacute;a agregar un filtro en los escenarios de entrada que compare el texto entrante con el &uacute;ltimo mensaje enviado en la misma conversaci&oacute;n. Pero no es necesario para la funcionalidad.
