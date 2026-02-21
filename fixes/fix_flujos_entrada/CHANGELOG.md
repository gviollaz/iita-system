# CHANGELOG — Fix Flujos de Entrada

## Fix 1 — WA Cloud API: Caption hardcodeado (P0)
- **Fecha:** 2026-02-18
- **Escenario:** [INPUT] IITA Chatbot - Whatsapp Cloud API (ID: 4097069)
- **Módulo:** Mod 8 (CallSubscenario con media)
- **Cambio:** Campo `text` del mapper cambiado de `{{1.entry[].changes[].value.messages[].image.caption}}` a `{{6.Messages}}`
- **Motivo:** El caption estaba hardcodeado a `image.caption`, ignorando captions de video y documentos. El Mod 6 ya calcula el caption correcto con if() anidados que cubren image, video y document.
- **Riesgo:** Bajo

## Fixes 2-6 — WA Coexistence San Lorenzo Chico (P0+P1)
- **Fecha:** 2026-02-18
- **Escenario:** [INPUT] San Lorenzo Chico - WhatsApp Coexistence (ID: 4161348)
- **Cambios aplicados:**

### Fix 2 (P0) — Mod 6: mediaId corrupto
- `sticker.id` estaba concatenado FUERA del `if()`, corrompiendo el mediaId para todos los tipos de media
- Reestructurado con `if()` anidados: image → audio → video → document → sticker

### Fix 3 (P0) — Mod 7: Caption usa video.id
- El campo `value` concatenaba `document.caption` y `video.id` (!) fuera de lógica condicional
- Reescrito con `if()` anidados consistentes: image.caption → video.caption → document.caption

### Fix 4 (P1) — Mod 5 y Mod 8: Falta status "new"
- Ninguno de los dos CallSubscenario enviaba `status: "new"` → interacciones quedaban con status NULL
- Las interacciones sin status nunca eran procesadas por Media Analysis (filtra por status='new')
- Agregado `"status": "new"` al mapper data de ambos módulos

### Fix 5 (P1) — Mod 5 y Mod 8: Fire-and-forget
- `shouldWaitForExecutionEnd` era `false` en ambos módulos → no esperaba confirmación
- Cambiado a `true` para consistencia con WA Cloud API e Instagram

### Fix 6 (P1) — Mod 5 y Mod 8: Spec incompleta
- Faltaba el campo `status` en la definición de inputs del subscenario
- Agregado campo status (type: select, enum: new/preprocessed/etc.)
- Actualizada la interface para retornar id_interaction e id_person_conversation
- Agregada metadata restore para status

## Fix 7 — WA Coexistence 3D: Mismos bugs que SL (P0+P1)
- **Fecha:** 2026-02-18
- **Escenario:** [INPUT] IITA 3D - WhatsApp Coexistence (ID: 3794481)
- **Verificación:** Confirmado que tenía idénticos bugs al flujo de San Lorenzo Chico
- **Módulos afectados:** Mod 38 (sin media), Mod 39 (getMedia), Mod 40 (caption), Mod 41 (con media)
- **Cambios aplicados (mismos que Fixes 2-6 adaptados a IDs de módulo 33/38/39/40/41):**
  - Mod 39: mediaId reestructurado con if() anidados (sticker.id estaba fuera)
  - Mod 40: Caption corregido de `document.caption + video.id + ifempty(image.caption)` a if() anidados
  - Mod 38+41: Agregado `status: "new"` al mapper
  - Mod 38+41: `shouldWaitForExecutionEnd` cambiado a `true`
  - Mod 38+41: Spec completada con campo status + interface corregida
- **Conexión:** IITA 3d (IMTCONN: 6007817, IMTHOOK: 1671730)
- **Riesgo:** Bajo (mismos cambios ya validados en SL)
