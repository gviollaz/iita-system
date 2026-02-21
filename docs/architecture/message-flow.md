# Flujo de mensajes — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

## Mensaje entrante (persona → sistema)

```
1. Persona envia mensaje por WhatsApp/Instagram
2. Make.com recibe via webhook
3. Make.com llama a crm-api → RPC process_incoming_message():
   - Verifica duplicado por external_ref
   - Busca/crea persona
   - Busca/crea conversacion (address + channel)
   - Inserta interaccion con status = 'new'
4. Trigger (Webhook) "New_interaction" notifica a Make.com
5. Escenario 4132732 "Pre-Processing" analiza media (GPT-4o-mini / Claude Haiku) *[Corregido por Gemini 3: 2026-02-20]*
   - Cambia status a 'preprocessed'
6. Escenario 4132827 "Respond Generation" genera respuesta IA
   - Inserta en ai_interaction con evaluation = 'pending'
7. Operador aprueba/rechaza en CRM (RPC approve_ai_response)
8. Si aprobada: crea interaccion saliente con status = 'pending_delivery'
9. Trigger "New_pending_delivery_and_send" → Make.com envia por el canal
```

## Mensaje directo (operador → persona desde CRM)

```
1. Operador usa "Enviar mensaje" en perfil de persona
2. Frontend → crm-api endpoint "send_to_person"
3. Busca/crea conversacion e inserta interaccion status = 'new'
4. Triggers notifican a Make.com para envio
```

## Echo de plataforma (operador responde desde Meta)

```
1. Operador responde desde Instagram/Meta Business Suite
2. Plataforma envia "eco" del mensaje
3. Make.com → RPC process_echo_message()
   - Verifica duplicado por external_ref
   - Si no existe: inserta como saliente con status = 'send'
4. Trigger trg_prevent_echo_interaction verifica adicionalmente
```

## Estados de interacciones

```
new → preprocessed → processed → pending_delivery → sending → send
```
