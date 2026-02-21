# Propuestas Pendientes

**Fecha:** 2026-02-20
**Autor:** Equipo IITA + AI

---

## Propuesta #1 - Manejo de Media en IA

**Problema:** La IA (Claude/OpenAI) que genera respuestas no tiene acceso al contenido de media adjunta (imagenes, audio, video, documentos). Cuando un usuario envia una imagen con una pregunta, la IA solo ve el texto y no puede interpretar la imagen.

**Propuesta:** Implementar manejo de media en 3 niveles progresivos:

1. **Nivel 1 - Descripcion textual:** Agregar al prompt de la IA una descripcion del tipo de media adjunta ("El usuario envio una imagen", "El usuario envio un audio de 15 segundos"). La IA no ve el contenido pero sabe que existe.

2. **Nivel 2 - Analisis previo:** Usar un servicio de vision (Claude Vision, GPT-4V) para generar una descripcion textual de la imagen antes de pasarla al generador de respuestas. Para audio, usar transcripcion (Whisper). El resultado se agrega al contexto del prompt.

3. **Nivel 3 - Multimodal nativo:** Enviar la media directamente al modelo multimodal (Claude 3+, GPT-4o) junto con el texto. Requiere que el modelo soporte el tipo de media.

**Razon por la que no se implemento:** Requiere cambios en el pipeline de Make.com (Etapa 3 - Preprocesamiento) y aumenta costos de API por el procesamiento adicional de media. Se necesita definir presupuesto y priorizar frente a otros P0.

---

## Propuesta #2 - Auto-cancel de IA por Respuesta Humana

**Problema:** Cuando un operador responde manualmente desde el telefono, la respuesta IA generada previamente sigue en estado `pending`. Si luego se aprueba desde el CRM, se envia una respuesta duplicada e incoherente (la IA responde algo que el humano ya respondio).

**Propuesta:** Implementar un mecanismo automatico que:
1. Detecte cuando llega un mensaje saliente (eco) para una conversacion.
2. Busque en `ai_interaction` si hay respuestas con status `pending` para esa conversacion.
3. Cambie el status de esas respuestas a `cancelled` (nuevo estado propuesto).
4. Registre en un log quien cancelo y por que motivo.

**Variantes consideradas:**
- **Trigger en DB:** Un trigger en `interactions` que al detectar direction=`outgoing` cancele las IA pendientes. Simple pero acoplado.
- **Logica en Make.com:** Un paso adicional en el flujo de eco que llame a un endpoint de cancelacion. Mas flexible pero agrega complejidad al escenario.

**Razon por la que no se implemento:** Se necesita primero resolver el bug de ecos duplicados (BUG-R002, ya resuelto) y definir el nuevo estado `cancelled` en el ciclo de vida de `ai_interaction`. Pendiente de decision sobre la variante preferida.

---

## Propuesta #3 - Normalizar MIME Types de Messenger

**Problema:** Los mensajes de Messenger llegan con MIME types no estandar o ausentes para ciertos tipos de media (stickers, GIFs, archivos compartidos). Esto causa que el sistema no pueda clasificar correctamente el tipo de media ni mostrarla en el frontend.

**Propuesta:**
1. Crear una tabla de mapeo de MIME types conocidos de Messenger a tipos estandar.
2. Agregar un paso de normalizacion en el preprocesamiento (Etapa 3) que traduzca los MIME types antes de almacenarlos.
3. Para tipos desconocidos, almacenar como `application/octet-stream` con un flag de revision.

**Razon por la que no se implemento:** El volumen de mensajes por Messenger es bajo comparado con WhatsApp. Se priorizo resolver los bugs P0 de WhatsApp (BUG-001 a BUG-003) primero.

---

## Propuesta #4 - JWT en Edge Functions

**Problema:** Las tres Edge Functions (`crm-api`, `courses-crud`, `create-test-user`) tienen `verify_jwt: false`, permitiendo acceso anonimo a toda la API. Cualquier persona con la URL puede leer y modificar 25K+ registros personales.

**Propuesta:**
1. Implementar login en el CRM con Supabase Auth (FEAT-010).
2. Modificar el frontend para enviar el JWT en el header `Authorization: Bearer <token>` en cada request.
3. Habilitar `verify_jwt: true` en las tres Edge Functions.
4. Agregar manejo de errores 401 en el frontend (redirigir a login).
5. Para endpoints que necesiten acceso sin auth (webhooks de Make.com), crear Edge Functions separadas con autenticacion por API key.

**Razon por la que no se implemento:** Si se habilita JWT sin tener login implementado, el CRM deja de funcionar completamente. Se necesita implementar FEAT-010 primero y hacer el cambio de forma coordinada.

---

## Propuesta #5 - Fix search_path en 15 Funciones (FINALIZADA)

**Problema:** 15 funciones PostgreSQL tenian `search_path` mutable, lo que permitia ataques de inyeccion de schema.

**Estado:** Implementada en el codigo fuente del repositorio (2026-02-20).

**Solucion Aplicada:** Se agrego `SET search_path = public` en la definicion de cada una de las 15 funciones RPC y funciones de trigger.

**Accion pendiente:** Ejecutar los scripts SQL en la base de datos de produccion para que los cambios surtan efecto en el entorno real.

---

## Propuesta #6 - Limpiar 107 Duplicados con Dependencias

**Problema:** Existen 107 registros duplicados en `person_conversation` que generan interacciones duplicadas en cascada. Estos duplicados se crearon antes de implementar el trigger `prevent_duplicate_conversation` (BUG-R003).

**Propuesta:**
1. Identificar los 107 `person_conversation` duplicados (mismo `person_id` + `conversation_id`).
2. Para cada duplicado, determinar cual registro conservar (el mas antiguo o el que tiene mas interacciones).
3. Migrar las interacciones del registro a eliminar al registro a conservar (UPDATE `interactions.id_person_conversation`).
4. Eliminar los registros duplicados de `person_conversation`.
5. Verificar integridad referencial post-limpieza.

**SQL de diagnostico:**
```sql
SELECT person_id, conversation_id, COUNT(*) as duplicados
FROM person_conversation
GROUP BY person_id, conversation_id
HAVING COUNT(*) > 1
ORDER BY duplicados DESC;
```

**Razon por la que no se implemento:** Requiere un script cuidadoso que maneje las dependencias (interacciones, system_conversation, etc.) sin perder datos. Se implemento la prevencion (trigger) pero la limpieza de datos historicos queda pendiente. Se debe ejecutar como operacion de datos documentada en DATA-OPERATIONS.md.
