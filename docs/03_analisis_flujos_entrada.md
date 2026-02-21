# Análisis y Plan de Mejoras — Flujos de Entrada Make (IITA)

**Fecha:** 17 de febrero 2026  
**Alcance:** 3 flujos de entrada en producción  
**Subscenario central:** SCN_3730125 — "Create new interaction"

---

## 1. Resumen de arquitectura actual

Los tres flujos siguen un patrón modular correcto:

```
Canal (Webhook/Módulo nativo)
  → Filtrar eventos irrelevantes
    → Normalizar datos
      → Call Subscenario "Create new interaction" (SCN_3730125)
```

Todos convergen en el mismo subscenario con una interfaz común:

| Campo | Descripción |
|-------|-------------|
| `external_ref` | ID del mensaje en la plataforma |
| `provider_name` | Canal (instagram, whatsapp cloud api, etc.) |
| `channel_address` | ID de la cuenta/número receptor |
| `person_address` | ID/número del contacto |
| `text` | Texto del mensaje |
| `is_user` | true = entrante, false = saliente |
| `person_name` | Nombre del contacto |
| `ad_id` | ID del anuncio (si vino de ads) |
| `media_data` | Media en base64 |
| `media_extension` | Extensión del archivo |
| `media_external_id` | ID/nombre del archivo de media |
| `status` | Estado (new, preprocessed, processed, etc.) |

---

## 2. Análisis por flujo

### 2.1 — [INPUT] IITA Salta - Instagram

**Trigger:** Custom Webhook (gateway:CustomWebHook)  
**Ops:** 2039 | **Data:** 654.7 MB  

**Estructura:**
```
Webhook → Router
  ├─ Verificación (hub.mode=subscribe) → Respond 200
  └─ Mensaje (filtros: no read, no edit, no story_mention, no ig_reel)
       ├─ Entrante (is_echo NOT exists)
       │    ├─ CON media → Download File → base64() → Call subscenario
       │    └─ SIN media → Call subscenario (solo texto)
       └─ Saliente (is_echo exists) → Call subscenario (is_user=false)
```

**Hallazgos:**

| # | Severidad | Problema | Impacto |
|---|-----------|----------|---------|
| 1 | 🔴 Crítico | Media se pasa como `base64(data)` al subscenario | 654 MB consumidos |
| 2 | 🟡 Medio | Webhook apunta a "IITA Salta Instagram desarrollo" | Posible confusión dev/prod |
| 3 | 🟡 Medio | `person_name` nunca se mapea | No se registra nombre del usuario |
| 4 | 🟡 Medio | `ad_id` nunca se mapea | Se pierden datos de atribución |
| 5 | 🟡 Medio | Ruta "saliente" no captura media | Respuestas con imagen se guardan sin media |
| 6 | 🟡 Medio | Sin error handlers | Fallas silenciosas |
| 7 | 🟢 Menor | No filtra stickers | Se descargan stickers innecesariamente |

---

### 2.2 — [INPUT] IITA Chatbot - WhatsApp Cloud API

**Trigger:** Custom Webhook (gateway:CustomWebHook)  
**Ops:** 384 | **Data:** 719.3 KB  

**Estructura:**
```
Webhook → Router
  ├─ Verificación (hub.mode=subscribe) → Respond 200
  └─ Mensaje (entry exists + entry.id=111869345312688 + contacts exists)
       ├─ Sin media → Call subscenario (texto + person_name)
       └─ Con media → Set Variable (caption) → Download File (API key) → Call subscenario (base64)
```

**Hallazgos:**

| # | Severidad | Problema | Impacto |
|---|-----------|----------|---------|
| 1 | 🔴 Crítico (Bug) | Variable `Messages` (caption) se calcula en módulo 6 pero no se usa en módulo 8 | Captions de video/document se pierden |
| 2 | 🔴 Crítico | Media también usa `base64(data)` | Mismo problema de consumo que Instagram |
| 3 | 🟡 Medio | No captura mensajes salientes | No hay ruta para is_echo/statuses |
| 4 | 🟡 Medio | `entry.id` hardcodeado a `111869345312688` | Atado a un solo WABA |
| 5 | 🟡 Medio | `ad_id` no se mapea | Sin atribución de ads |
| 6 | 🟡 Medio | Sin error handlers | Misma situación que Instagram |
| 7 | 🟢 Menor | API Key label dice "meta app IITA - Pruebas" | Verificar token |

**Corrección inmediata del bug de caption:**  
En módulo 8 (Call Subscenario), cambiar:
```
"text": "{{1.entry[].changes[].value.messages[].image.caption}}"
```
Por:
```
"text": "{{6.Messages}}"
```

---

### 2.3 — [INPUT] San Lorenzo Chico - WhatsApp Coexistence

**Trigger:** Módulo nativo WhatsApp Business Cloud (watchEvents2)  
**Ops:** 0 (nuevo) | **Data:** 0  

**Estructura:**
```
Watch Events → Router
  ├─ Mensaje cliente (messages exists) → Router (con fallback/else)
  │    ├─ Sin media → Call subscenario (no wait)
  │    └─ Con media → Get Media (nativo) → Set Variable (caption) → Call subscenario (no wait, base64)
  └─ Self (statuses exists + status=delivered) → Call subscenario (is_user=false, "Respondido desde telefono")
```

**Hallazgos:**

| # | Severidad | Problema | Impacto |
|---|-----------|----------|---------|
| 1 | 🔴 Crítico (Bug) | Extracción de media ID tiene sticker.id prepended fuera del if() | Corrompe mediaId para todos los tipos de media |
| 2 | 🔴 Crítico (Bug) | Caption extrae `video.id` en lugar de `video.caption` | Guarda el ID del video, no su caption |
| 3 | 🟡 Medio | Ruta "self" guarda texto hardcodeado "Respondido desde telefono" | No se captura contenido real |
| 4 | 🟡 Medio | `shouldWaitForExecutionEnd: false` | No espera confirmación del subscenario |
| 5 | 🟡 Medio | No envía campo `status` al subscenario | Interacciones quedan sin status |
| 6 | 🟡 Medio | Filtro "Contiene media" tiene conditions vacías `[]` | Depende del fallback/else, frágil |
| 7 | 🟢 Positivo | Usa `display_phone_number` para channel_address | Más legible |
| 8 | 🟢 Positivo | Usa módulo nativo Get Media | Mejor integración |
| 9 | 🟢 Positivo | Captura mensajes salientes (statuses) | Único flujo WA que lo hace |

**Corrección del bug de media ID (módulo 6):**  
Actual:
```
"mediaId": "{{2.messages[].sticker.id}}{{if(2.messages[].image.id != null; ...)}}"
```
Correcto:
```
"mediaId": "{{if(2.messages[].image.id != null; 2.messages[].image.id; if(2.messages[].audio.id != null; 2.messages[].audio.id; if(2.messages[].video.id != null; 2.messages[].video.id; if(2.messages[].document.id != null; 2.messages[].document.id; 2.messages[].sticker.id))))}}"
```

**Corrección del bug de caption (módulo 7):**  
Actual:
```
"value": "{{2.messages[].document.caption}}{{2.messages[].video.id}}{{ifempty(...)}}"
```
Correcto:
```
"value": "{{ifempty(2.messages[].image.caption; ifempty(2.messages[].video.caption; ifempty(2.messages[].document.caption; null)))}}"
```

---

## 3. Tabla comparativa cruzada

| Aspecto | Instagram Salta | WA Cloud API (Chatbot) | WA Coexistence (San Lorenzo) |
|---------|----------------|----------------------|------------------------------|
| **Trigger** | Custom Webhook | Custom Webhook | Módulo nativo |
| **person_name** | ❌ No | ✅ Sí | ✅ Sí |
| **ad_id** | ❌ No | ❌ No | ❌ No |
| **Msg salientes** | ✅ is_echo | ❌ No | ✅ statuses (pero sin contenido real) |
| **Caption media** | ❌ No captura | 🐛 Bug: solo image | 🐛 Bug: video.id en vez de caption |
| **Media handling** | base64 en subscenario | base64 en subscenario | base64 en subscenario |
| **Wait for sub** | ✅ true | ✅ true | ❌ false |
| **status field** | ✅ "new" | ✅ "new" | ❌ No envía |
| **Error handling** | ❌ Ninguno | ❌ Ninguno | ❌ Ninguno |
| **Sticker filter** | ❌ No filtra | N/A | ✅ Lo incluye en media check |

---

## 4. Plan de mejoras

### 4.1 — Fase 1: Fixes urgentes (bugs que pierden datos)

| Prioridad | Acción | Flujo | Esfuerzo |
|-----------|--------|-------|----------|
| P0 | Fix caption: usar `{{6.Messages}}` en módulo 8 | WA Cloud API | 2 min |
| P0 | Fix media ID: quitar sticker.id suelto, meter en if() | WA Coexistence | 5 min |
| P0 | Fix caption: cambiar `video.id` por `video.caption` | WA Coexistence | 2 min |

### 4.2 — Fase 2: Consistencia entre flujos (1-2 días)

| Prioridad | Acción | Flujo(s) | Detalle |
|-----------|--------|----------|---------|
| P1 | Agregar `person_name` via Graph API | Instagram | GET /{user-id}?fields=name,username |
| P1 | Agregar campo `status: "new"` | WA Coexistence | Alinear con los otros flujos |
| P1 | Capturar `ad_id` donde aplique | Instagram + WA Cloud | `referral.ad_id` en ambos |
| P2 | Unificar `shouldWaitForExecutionEnd` | WA Coexistence | Cambiar a `true` |
| P2 | Estandarizar `channel_address` | Todos | Decidir: ¿ID numérico o display_phone_number? |

### 4.3 — Fase 3: Optimización de consumo (3-5 días)

| Prioridad | Acción | Impacto |
|-----------|--------|---------|
| P1 | Eliminar base64 de media: subir a Supabase Storage y pasar solo URL | Reduce consumo de ~654 MB a ~pocos KB |
| P2 | Filtrar stickers en Instagram | Evita descargas innecesarias |
| P2 | Agregar filtro de tamaño de media | Evita que videos grandes congelen el flujo |

### 4.4 — Fase 4: Robustez y observabilidad (ongoing)

| Prioridad | Acción | Detalle |
|-----------|--------|---------|
| P2 | Agregar error handlers en todos los módulos HTTP | Loguear errores a tabla `make_errors` en Supabase |
| P2 | Crear flujo de monitoreo | Alertar cuando un flujo tiene más de N errores |
| P3 | Documentar el "contrato" del subscenario | Campos requeridos/opcionales, validaciones, ejemplos |

---

## 5. Próximos pasos sugeridos

1. **Ahora:** Aplicar los 3 fixes P0 (bugs de caption y media ID)
2. **Esta semana:** Revisar subscenario "Create new interaction" para planificar cambio de base64 a Storage URL
3. **Próxima semana:** Implementar consistencia entre flujos (Fase 2)
4. **Mes:** Migrar a Supabase Storage para media (Fase 3)
