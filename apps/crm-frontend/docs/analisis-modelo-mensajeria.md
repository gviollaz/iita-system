# Análisis del modelo de datos: Mensajería, IA y envío de mensajes desde el CRM

Fecha: 2026-02-16

---

## 1. Tablas involucradas

### 1.1 `conversations`

| Columna      | Tipo      | Descripción                    |
|-------------|-----------|--------------------------------|
| id          | int (PK)  | ID autoincremental              |
| start_date  | timestamp | Fecha de inicio de la conversación |

Tabla muy simple. Solo contiene el ID y la fecha. Toda la riqueza está en las interacciones vinculadas.

---

### 1.2 `interactions`

| Columna                  | Tipo                    | Descripción                                                        |
|--------------------------|-------------------------|--------------------------------------------------------------------|
| id                       | int (PK)                | ID autoincremental                                                  |
| external_ref             | text                    | Referencia externa (WAMID de WhatsApp, ref de Instagram, etc.)     |
| id_person_conversation   | int (FK → conversations)| Si tiene valor → mensaje ENTRANTE (la persona escribió)            |
| id_system_conversation   | int (FK → conversations)| Si tiene valor → mensaje SALIENTE (el sistema/operador respondió)  |
| text                     | text (nullable)         | Contenido del mensaje. Puede ser null si es solo media             |
| time_stamp               | timestamp               | Fecha y hora del mensaje                                           |
| ad_id                    | int (FK → ads, nullable)| Referencia a publicidad si el mensaje viene de un anuncio          |
| status                   | enum `interaction_status`| Estado del mensaje                                                 |

**Valores válidos de `interaction_status`:**

| Valor          | Significado                                                                 |
|---------------|-----------------------------------------------------------------------------|
| `new`          | Mensaje nuevo, pendiente de procesamiento                                   |
| `preprocessed` | Pre-procesado (mensajes entrantes de persona, ya registrados)              |
| `processed`    | Procesado por el sistema                                                    |
| `send`         | Enviado al canal externo (WhatsApp, Instagram, etc.)                       |

**Dirección del mensaje (clave):**
- `id_person_conversation = N` + `id_system_conversation = NULL` → **ENTRANTE** (persona → sistema)
- `id_system_conversation = N` + `id_person_conversation = NULL` → **SALIENTE** (sistema → persona)

Nunca se llenan ambos a la vez. Solo uno de los dos tiene valor, el otro queda en null.

---

### 1.3 `ai_interaction`

| Columna                    | Tipo                     | Descripción                                                         |
|---------------------------|--------------------------|---------------------------------------------------------------------|
| id                        | int (PK)                 | ID autoincremental                                                   |
| associated_interaction_id | int (FK → interactions)  | ID de la interacción entrante que disparó la respuesta de IA        |
| generated_interaction_id  | int (FK → interactions, nullable) | ID de la interacción saliente generada tras la aprobación  |
| response                  | text                     | Texto de la respuesta generada por la IA                            |
| system_prompt             | text (NOT NULL)          | Prompt del sistema usado para generar la respuesta                  |
| evaluation                | text                     | Estado de evaluación de la respuesta                                |

**Valores de `evaluation`:**

| Valor        | Significado                                                                  |
|-------------|------------------------------------------------------------------------------|
| `pending`    | La IA generó la respuesta pero aún no fue evaluada por un humano            |
| `approved`   | Un operador aprobó la respuesta (lista para ser enviada)                    |
| `confictive` | Un operador la marcó como conflictiva/rechazada                             |

---

### 1.4 `medias`

| Columna     | Tipo          | Descripción                                     |
|------------|---------------|--------------------------------------------------|
| id         | int (PK)      | ID autoincremental                                |
| name       | text          | Nombre del archivo                                |
| content_dir| text          | Ruta o URL del archivo                            |
| type       | text          | Extensión (jpeg, pdf, mp4, etc.)                 |
| description| text (nullable)| Descripción del contenido                       |
| disabled   | bool          | Si el media está deshabilitado                    |

---

### 1.5 `interaction_medias`

| Columna        | Tipo                    | Descripción                            |
|---------------|-------------------------|----------------------------------------|
| id            | int (PK)                | ID autoincremental                      |
| interaction_id| int (FK → interactions) | Interacción asociada                    |
| media_id      | int (FK → medias)       | Media asociada                          |

Tabla pivote que vincula una interacción con sus archivos multimedia.

---

## 2. Flujo actual: Mensaje de IA

```
┌──────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE RESPUESTA DE IA                          │
│                                                                      │
│  1. Persona envía mensaje                                            │
│     → INSERT en interactions                                         │
│       id_person_conversation = conv_id                               │
│       status = "preprocessed"                                        │
│                                                                      │
│  2. Sistema de IA procesa el mensaje                                 │
│     → INSERT en ai_interaction                                       │
│       associated_interaction_id = id del msg entrante                │
│       response = "texto generado por IA"                             │
│       system_prompt = "prompt completo"                              │
│       evaluation = "pending"                                         │
│       generated_interaction_id = NULL                                │
│                                                                      │
│  3. Operador evalúa en el CRM                                       │
│     → UPDATE ai_interaction                                          │
│       evaluation = "approved" (o "confictive")                       │
│                                                                      │
│  4. Proceso externo lee ai_interaction.evaluation = "approved"       │
│     con generated_interaction_id = NULL                              │
│     → INSERT en interactions                                         │
│       id_system_conversation = conv_id                               │
│       text = ai_interaction.response                                 │
│       status = "send"                                                │
│       external_ref = WAMID del envío                                 │
│     → UPDATE ai_interaction                                          │
│       generated_interaction_id = id del nuevo interaction            │
│                                                                      │
│  5. El mensaje queda vinculado:                                      │
│     ai_interaction.associated_interaction_id → msg entrante          │
│     ai_interaction.generated_interaction_id → msg saliente enviado   │
└──────────────────────────────────────────────────────────────────────┘
```

**Observaciones clave:**
- El proceso externo busca: `evaluation = "approved" AND generated_interaction_id IS NULL`
- Cuando lo envía, llena `generated_interaction_id` y pone `status = "send"` en la interacción creada
- Esto significa que `generated_interaction_id = NULL` es la señal de "pendiente de envío"

---

## 3. Opciones para mensajes manuales del CRM

### Opción A: Insertar solo en `interactions` (implementación actual)

```
CRM → INSERT interactions (status="new", id_system_conversation=conv_id)
     → Proceso externo lee status="new", lo envía y pone status="send"
```

**Pros:** Simple, directo.
**Contras:** El proceso externo debe saber buscar TAMBIÉN `interactions.status = "new"` además de `ai_interaction.evaluation = "approved"`. Son dos flujos distintos que el proceso debe manejar.

### Opción B: Insertar en `ai_interaction` (recomendada)

```
CRM → INSERT interactions (status="preprocessed", id_system_conversation=conv_id)
CRM → INSERT ai_interaction (
        associated_interaction_id = id del interaction creado,
        response = texto del operador,
        system_prompt = "CRM: Mensaje manual del operador",
        evaluation = "approved",
        generated_interaction_id = NULL
      )
     → Proceso externo lee ai_interaction con evaluation="approved"
       y generated_interaction_id=NULL (mismo flujo que IA aprobada)
     → Crea el interaction final con status="send"
     → Llena generated_interaction_id
```

**Pros:**
- **Un solo flujo** para el proceso externo: siempre lee `ai_interaction` con `evaluation = "approved" AND generated_interaction_id IS NULL`
- El mensaje manual queda registrado igual que uno de IA, con trazabilidad completa
- Se puede distinguir un mensaje manual de uno de IA por el `system_prompt` (ej: "CRM: Mensaje manual")
- Consistente con la arquitectura existente

**Contras:**
- Requiere insertar en dos tablas en vez de una
- El campo `system_prompt` es NOT NULL, hay que poner algo (pero es útil para distinguir origen)

### Opción C: Insertar en `interactions` con `status = "new"` + `ai_interaction` como wrapper

Híbrido: se crea la interaction saliente directamente y también el registro en ai_interaction para que el proceso externo lo tome.

---

## 4. Recomendación

**La Opción B es la más consistente** con la arquitectura actual:

1. El proceso externo ya tiene un único punto de lectura: `ai_interaction` con `evaluation = "approved"` y `generated_interaction_id IS NULL`
2. No requiere modificar el proceso externo
3. Mantiene la trazabilidad completa de quién generó la respuesta (IA vs operador humano)
4. El campo `system_prompt` permite identificar el origen: `"CRM: Mensaje manual del operador"` vs el prompt largo de la IA

### Flujo propuesto para el CRM:

```
1. Operador escribe mensaje en el CRM

2. Frontend inserta en ai_interaction:
   - associated_interaction_id = NULL (no hay mensaje entrante asociado, es proactivo)
   - response = "texto escrito por el operador"
   - system_prompt = "CRM: Mensaje manual del operador"
   - evaluation = "approved"
   - generated_interaction_id = NULL

3. Proceso externo (sin cambios):
   - Lee ai_interaction WHERE evaluation="approved" AND generated_interaction_id IS NULL
   - Envía el mensaje por el canal correspondiente
   - Crea la interaction con status="send"
   - Actualiza generated_interaction_id

4. El CRM muestra el mensaje como "pendiente de envío" hasta que
   generated_interaction_id se llene (o status del interaction pase a "send")
```

### Pregunta abierta:

El `associated_interaction_id` normalmente apunta al mensaje entrante que disparó la IA. Para un mensaje proactivo del operador:
- **Opción 1**: Dejarlo en NULL (no hay mensaje entrante asociado)
- **Opción 2**: Apuntarlo al último mensaje de la persona en esa conversación
- **Opción 3**: Crear primero una interaction "placeholder" del sistema y asociarla

Esto depende de cómo el proceso externo resuelve a qué conversación/canal enviar el mensaje. Si usa `associated_interaction_id` para determinar la conversación de destino, entonces necesitamos apuntarlo a un interaction existente de esa conversación.

---

## 5. Datos de acceso verificados

| Tabla               | SELECT | INSERT | UPDATE | DELETE | Via            |
|--------------------|--------|--------|--------|--------|----------------|
| conversations      | ✅      | ?      | ?      | ?      | Edge Function  |
| interactions       | ✅      | ✅      | ✅      | ✅      | Edge Function  |
| ai_interaction     | ✅      | ✅      | ✅      | ✅      | Edge Function  |
| medias             | ✅      | ✅      | ✅      | ✅      | Edge Function  |
| interaction_medias | ✅      | ✅      | ✅      | ✅      | Edge Function  |
| channels           | ✅      | ?      | ?      | ?      | Edge Function  |
| persons            | ✅      | ?      | ✅      | ?      | Edge Function  |

**Nota:** La tabla `ai_interaction` NO es accesible por REST directo con la anon key (RLS bloquea insert). Pero SÍ es accesible via la Edge Function `crm-api` usando `action: insert/update/delete`.

---

## 6. Enums del modelo

### `interaction_status` (tabla interactions)
- `new`
- `preprocessed`
- `processed`
- `send`

### `evaluation` (tabla ai_interaction)
- `pending`
- `approved`
- `confictive`
