# Guía: Modificar escenarios de Make.com para evitar duplicados

## Resumen del cambio

**Antes:** Make.com usaba 4-5 módulos de Supabase para registrar un mensaje entrante:
1. Buscar persona → si no existe, crear persona
2. Buscar conversación → si no existe, crear conversations
3. Crear person_conversation
4. Crear system_conversation
5. Insertar interaction

**Problema:** Cuando llegan 2 mensajes simultáneos (70ms de diferencia), los dos escenarios ejecutan el paso 1-4 en paralelo y ambos crean registros duplicados porque ninguno "ve" lo que el otro creó.

**Ahora:** Un solo módulo HTTP reemplaza los 5 pasos anteriores. La función atómica en la base de datos maneja todo con candados para evitar duplicados.

---

## Endpoint: `incoming_message` (mensaje ENTRANTE)

**URL:** `https://cpkzzzwncpbzexpesock.supabase.co/functions/v1/crm-api`

**Método:** POST

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "endpoint": "incoming_message",
  "params": {
    "address": "{{IGSID o número de teléfono del contacto}}",
    "channel_id": "{{ID del canal - ver tabla abajo}}",
    "text": "{{Texto del mensaje}}",
    "external_ref": "{{Message ID de Meta (mid)}}",
    "person_name": "{{Nombre del contacto si viene del webhook}}",
    "ad_external_ref": "{{ID del anuncio si aplica, o null}}"
  }
}
```

**Respuesta exitosa:**
```json
{
  "data": {
    "success": true,
    "person_id": 25567,
    "conversation_id": 25888,
    "person_conversation_id": 25888,
    "system_conversation_id": 25877,
    "interaction_id": 102315,
    "ad_id": null,
    "new_person": false,
    "new_conversation": false
  }
}
```

---

## Endpoint: `outgoing_message` (mensaje SALIENTE)

**Body:**
```json
{
  "endpoint": "outgoing_message",
  "params": {
    "address": "{{IGSID o número de teléfono destino}}",
    "channel_id": "{{ID del canal}}",
    "text": "{{Texto del mensaje enviado}}",
    "external_ref": "{{Message ID de Meta}}",
    "status": "send"
  }
}
```

---

## IDs de canales

| ID | Canal | Proveedor | Dirección del canal |
|----|-------|-----------|---------------------|
| 1  | IITA Administración | whatsapp | 5493872550001 |
| 2  | IITA 3D | whatsapp | 5493875809318 |
| 3  | IITA Tesorería | whatsapp | 5493872550003 |
| 4  | IITA San Lorenzo | whatsapp | 5493876844174 |
| 5  | IITA Cursos | whatsapp | 5493875809351 |
| 6  | IITA Salta - Instagram | instagram | 17841404168256335 |
| 7  | IITA San Lorenzo chico - Instagram | instagram | 17841455198100771 |
| 8  | IITA Salta - Messenger | messenger | 296373163870909 |
| 9  | IITA San Lorenzo Chico - Messenger | messenger | 106307535517599 |
| 10 | Chatbot (Cloud API) | whatsapp cloud api | 111869345312688 |
| 11 | IITA Cursos Email | email | cursosiita@gmail.com |

---

## Cómo modificar cada escenario en Make.com

### Escenario de mensajes entrantes (Instagram/Messenger/WhatsApp)

**Paso 1:** Identificar los módulos que actualmente hacen:
- "Search rows" en `person_conversation` o `persons`
- "Create a row" en `conversations`
- "Create a row" en `person_conversation`
- "Create a row" en `system_conversation`
- "Create a row" en `interactions`

**Paso 2:** Reemplazar TODOS esos módulos por UN solo módulo **"HTTP - Make a request"**:

```
URL:    https://cpkzzzwncpbzexpesock.supabase.co/functions/v1/crm-api
Método: POST
Headers:
  Content-Type: application/json
Body type: Raw → JSON
Body:
{
  "endpoint": "incoming_message",
  "params": {
    "address": "{{1.sender.id}}",
    "channel_id": 6,
    "text": "{{1.message.text}}",
    "external_ref": "{{1.message.mid}}",
    "person_name": "{{1.sender.name}}",
    "ad_external_ref": "{{1.referral.ad_id}}"
  }
}
```

> **Nota:** Los campos `{{1.sender.id}}`, `{{1.message.text}}`, etc. dependen del módulo trigger del escenario. Reemplazalos con los datos reales que llegan del webhook de Meta.

**Paso 3:** El resultado del HTTP request contiene `person_id`, `conversation_id`, `interaction_id`, etc. que se usan en los módulos siguientes.

Para acceder a los valores del resultado:
- `{{HTTP.body.data.person_id}}`
- `{{HTTP.body.data.conversation_id}}`
- `{{HTTP.body.data.interaction_id}}`
- `{{HTTP.body.data.new_person}}` → true/false
- `{{HTTP.body.data.new_conversation}}` → true/false

### Para el escenario de registro de mensajes SALIENTES

Mismo proceso, pero usando el endpoint `outgoing_message`:

```json
{
  "endpoint": "outgoing_message",
  "params": {
    "address": "{{destinatario}}",
    "channel_id": 6,
    "text": "{{texto_enviado}}",
    "external_ref": "{{mid_de_meta}}",
    "status": "send"
  }
}
```

---

## Determinar el channel_id dinámicamente

Si un mismo escenario maneja múltiples canales, se puede determinar el `channel_id` basándose en la dirección del canal:

**Opción A: Router con filtros en Make.com**
- Ruta 1: Si page_id = `17841404168256335` → channel_id = 6 (IITA Salta IG)
- Ruta 2: Si page_id = `17841455198100771` → channel_id = 7 (SL Chico IG)

**Opción B: Usar un módulo HTTP previo para resolver el canal**
```json
{
  "action": "select",
  "table": "channels",
  "select": "id",
  "filters": [{"col": "address", "op": "eq", "val": "{{page_id}}"}]
}
```

---

## Verificación

Después de modificar un escenario:

1. **Probar con un mensaje real** - Enviar un mensaje desde Instagram/WhatsApp
2. **Verificar en el CRM** - El mensaje debería aparecer en la conversación correcta
3. **Probar con 2 mensajes rápidos** - Enviar 2 mensajes seguidos al mismo contacto
4. **Verificar que NO hay duplicados** - Debería haber 1 sola conversación con 2 mensajes

---

## Escenarios que NO necesitan cambios

Los siguientes triggers de Supabase siguen funcionando porque operan sobre la tabla `interactions`:

- **Pre-Processing** → INSERT en `interactions` ✅
- **Respond Generation - Prod** → UPDATE en `interactions` ✅
- **New_pending_delivery_and_send** → INSERT/UPDATE en `interactions` ✅
- **New_interaction** → INSERT en `interactions` ✅

Solo se necesita cambiar los escenarios que **crean** conversaciones y personas.
