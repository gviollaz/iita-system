# RFC-002: Evaluacion y aprobacion automatica de mensajes IA con buena calificacion

- **Fecha de creacion:** 2026-02-20
- **Ultima actualizacion:** 2026-02-20
- **Estado:** en_discusion
- **Prioridad:** P1
- **Autor original:** gviollaz + Claude Opus 4.6 (Claude Code)
- **Componentes afectados:** Make.com, Supabase DB, Frontend (CRM)
- **Ref FEAT:** FEAT-014 (Evaluacion Automatica de IA)
- **Ref Roadmap:** Fase 6.3

---

## Resumen ejecutivo

Actualmente todas las respuestas generadas por IA requieren aprobacion manual de un operador humano antes de ser enviadas. Esto genera un cuello de botella: hay momentos del dia donde se acumulan respuestas pendientes y el usuario recibe la respuesta con horas de retraso. Proponemos un sistema de evaluacion automatica con scoring de confianza que permita auto-aprobar respuestas de alta calidad, manteniendo la revision humana solo para las dudosas o de bajo scoring.

## Problema

### Situacion actual

1. Llega un mensaje entrante.
2. Make.com genera respuesta con IA (Claude/OpenAI).
3. La respuesta se guarda en `ai_interaction` con `evaluation = 'pending'`.
4. Un operador humano la revisa desde el CRM y la aprueba o rechaza.
5. Solo despues de la aprobacion, Make.com envia la respuesta.

**Problemas concretos:**
- **12K respuestas IA** en `ai_interaction`, todas requirieron revision manual.
- En horario no laboral (noches, fines de semana), las respuestas se acumulan sin aprobar.
- Muchas respuestas son triviales y seguras (saludos, informacion basica de cursos, horarios) y no necesitarian revision.
- El operador aprueba ~90%+ de las respuestas sin modificarlas — revision es redundante en la mayoria de los casos.

### Etapa 5 del pipeline (actualmente vacia)

El pipeline de Make.com tiene 8 etapas. La **Etapa 5 (Evaluacion)** fue disenada pero nunca implementada. Es exactamente el lugar para este feature.

```
Etapa 3 (Preproceso) → Etapa 4 (Generacion IA) → [Etapa 5 VACIA] → Etapa 6 (Aprobacion manual)
```

## Solucion propuesta

### Opcion A: Scoring con segundo modelo IA (recomendada)

Usar un modelo IA rapido y barato (GPT-4o-mini o Claude Haiku) para evaluar la respuesta generada y asignar un score de confianza. Segun el score, auto-aprobar o enviar a revision.

**Flujo propuesto:**
```
Respuesta generada → Evaluador IA → Score 0-100
                                        ├─ Score >= 85 → auto_approved → Enviar
                                        ├─ Score 50-84 → pending → Revision manual
                                        └─ Score < 50  → flagged → Revision prioritaria
```

**Criterios de evaluacion para el scoring:**
1. **Relevancia:** La respuesta contesta la pregunta del usuario?
2. **Precision:** La informacion de cursos/horarios/precios es correcta? (comparar con datos de DB)
3. **Tono:** Es profesional y apropiado?
4. **Seguridad:** No contiene informacion sensible, promesas o compromisos contractuales?
5. **Completitud:** Responde todo lo que el usuario pregunto?

- **Pros:** Flexible, aprende de los criterios del prompt. Puede mejorar con el tiempo.
- **Contras:** Costo adicional por llamada a API. Posibilidad de falsos positivos.
- **Esfuerzo:** Medio (1-2 semanas)
- **Impacto:** Critico — reduce carga del operador en 80%+

### Opcion B: Reglas deterministicas

Definir reglas fijas que determinen si una respuesta se auto-aprueba:
- Si la conversacion tiene < 3 mensajes y la respuesta es sobre info de cursos → auto-aprobar
- Si la respuesta contiene palabras clave de riesgo (precio, pago, descuento, beca) → revision manual
- Si es un saludo o agradecimiento → auto-aprobar

- **Pros:** Predecible, sin costo API extra, rapido.
- **Contras:** Rigido, no se adapta a nuevos casos. Muchos falsos negativos.
- **Esfuerzo:** Bajo (3-5 dias)
- **Impacto:** Medio — solo cubre casos obvios.

### Opcion C: Hibrido (reglas + scoring)

Combinar ambas: reglas para casos obvios (saludos, fuera de horario) + scoring IA para el resto.

- **Pros:** Lo mejor de ambos mundos.
- **Contras:** Mas complejidad.
- **Esfuerzo:** Medio-Alto (2-3 semanas)
- **Impacto:** Critico

## Diseno tecnico

### Cambios en base de datos

```sql
-- Nuevos campos en ai_interaction
ALTER TABLE ai_interaction ADD COLUMN confidence_score INTEGER; -- 0-100
ALTER TABLE ai_interaction ADD COLUMN evaluation_model TEXT; -- modelo que evaluo
ALTER TABLE ai_interaction ADD COLUMN evaluation_criteria JSONB; -- detalle del scoring
ALTER TABLE ai_interaction ADD COLUMN evaluated_at TIMESTAMPTZ;

-- Nuevo valor en el ciclo de evaluacion
-- Actual: pending → approved | confictive
-- Propuesto: pending → auto_approved | approved | confictive | flagged
-- Nota: 'confictive' es typo historico, no renombrar sin migracion

-- Tabla de configuracion de auto-aprobacion
CREATE TABLE ai_evaluation_config (
  id SERIAL PRIMARY KEY,
  auto_approve_threshold INTEGER DEFAULT 85,  -- score minimo para auto-aprobar
  flag_threshold INTEGER DEFAULT 50,           -- score minimo para no flagear
  auto_approve_enabled BOOLEAN DEFAULT false,  -- switch global on/off
  auto_approve_hours JSONB,                    -- horarios donde se activa auto-aprobacion
  excluded_topics TEXT[],                      -- temas que siempre requieren revision
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar config por defecto (conservadora: apagado)
INSERT INTO ai_evaluation_config (auto_approve_enabled) VALUES (false);
```

### Cambios en Make.com (Etapa 5 — nuevo escenario)

**Nombre:** "AI Evaluation Pipeline"

**Modulos:**
1. **Trigger:** Webhook cuando `ai_interaction` se crea con `evaluation = 'pending'`
2. **Fetch config:** Leer `ai_evaluation_config` de Supabase
3. **Si auto_approve_enabled = false:** No hacer nada (flujo actual)
4. **Si auto_approve_enabled = true:**
   - Armar prompt de evaluacion con: mensaje original + respuesta IA + datos de cursos relevantes
   - Llamar a modelo evaluador (GPT-4o-mini / Claude Haiku)
   - Parsear score y criterios
   - Guardar en `ai_interaction` (confidence_score, evaluation_criteria, evaluated_at)
   - Si score >= threshold → UPDATE evaluation = 'auto_approved', notificar Etapa 7 (envio)
   - Si score < flag_threshold → UPDATE evaluation = 'flagged'
   - Si entre ambos → dejar como 'pending'

### Prompt de evaluacion (borrador)

```
Sos un evaluador de calidad de respuestas de un CRM educativo.
Tu trabajo es evaluar si esta respuesta es segura para enviar automaticamente.

MENSAJE DEL USUARIO:
{message_text}

RESPUESTA GENERADA POR IA:
{ai_response}

CONTEXTO (cursos disponibles, precios, etc.):
{context_data}

Evalua la respuesta en una escala de 0 a 100 segun estos criterios:
1. Relevancia (0-25): Responde lo que el usuario pregunto?
2. Precision (0-25): La informacion es correcta segun el contexto provisto?
3. Tono (0-25): Es profesional, empatico y apropiado?
4. Seguridad (0-25): NO contiene promesas, precios inventados, ni compromisos contractuales?

RESPONDE SOLO en formato JSON:
{
  "score": <0-100>,
  "relevancia": <0-25>,
  "precision": <0-25>,
  "tono": <0-25>,
  "seguridad": <0-25>,
  "auto_approve": <true|false>,
  "motivo": "<explicacion breve>"
}
```

### Cambios en Edge Functions

```typescript
// Nuevo endpoint en crm-api
if (endpoint === "ai_evaluation_config") {
  // GET: obtener config actual
  // POST: actualizar config (solo admins)
}

if (endpoint === "ai_evaluation_stats") {
  // Estadisticas: % auto-aprobadas, distribution de scores, precision del evaluador
}
```

### Cambios en frontend

```jsx
// En Conversations.jsx:
// - Mostrar badge de score junto a la respuesta IA (ej: "🟢 92/100")
// - Diferenciar visualmente auto_approved vs approved manual
// - Filtro nuevo: "Solo pendientes de revision" (excluir auto-aprobadas)

// Nueva seccion en Dashboard o Health:
// - Grafico de distribucion de scores
// - % de auto-aprobacion por dia
// - Alertas si el score promedio baja (puede indicar problema con el modelo)

// Nueva pagina o seccion de configuracion:
// - Toggle on/off de auto-aprobacion
// - Ajustar thresholds (slider: 0-100)
// - Definir horarios de auto-aprobacion
// - Lista de temas excluidos
```

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | Agregar campos a `ai_interaction` y crear `ai_evaluation_config` | Supabase DB | 1 hora |
| 2 | Crear escenario de evaluacion en Make.com (Etapa 5) | Make.com | 2-3 dias |
| 3 | Disenar y testear prompt de evaluacion con datos reales | Make.com | 1 dia |
| 4 | Implementar logica de auto-aprobacion (conservadora: threshold alto) | Make.com | 1 dia |
| 5 | Agregar endpoint de config en crm-api | Edge Functions | 2 horas |
| 6 | Mostrar scores en el frontend (Conversations.jsx) | Frontend | 1 dia |
| 7 | Panel de configuracion en frontend | Frontend | 1-2 dias |
| 8 | Monitoreo: estadisticas de evaluacion | Frontend + DB | 1 dia |
| 9 | Periodo de prueba: activar con threshold alto (95+), monitorear | Operaciones | 1 semana |
| 10 | Ajustar thresholds basado en datos reales | Operaciones | continuo |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Auto-aprobar respuesta incorrecta | Alto | Empezar con threshold muy alto (95+). Periodo de prueba con revision retroactiva. |
| Costo adicional por evaluacion | Bajo | GPT-4o-mini cuesta ~$0.001 por evaluacion. Para 100 msgs/dia = $3/mes |
| Modelo evaluador tambien se equivoca | Medio | Comparar evaluaciones con aprobaciones manuales. Medir precision. |
| Respuesta con informacion de precios incorrecta auto-aprobada | Alto | Excluir temas de precios/pagos de auto-aprobacion. Criterio "seguridad" penaliza fuerte. |
| Operador pierde visibilidad de lo que se envia | Medio | Dashboard muestra TODO lo enviado (auto y manual). Notificaciones de auto-aprobaciones. |

## Criterios de aceptacion

- [ ] Nuevo campo `confidence_score` en `ai_interaction` poblado para cada respuesta
- [ ] Tabla `ai_evaluation_config` con switch global on/off
- [ ] Auto-aprobacion funcional para score >= threshold configurado
- [ ] Frontend muestra score y diferencia auto_approved vs approved
- [ ] Panel de configuracion accesible para admin
- [ ] Periodo de prueba de 1 semana sin errores criticos
- [ ] Precision del evaluador >= 95% (comparado con decisiones humanas historicas)

## Dependencias

- **Requiere:** Pipeline de Make.com funcionando (Etapa 4 generando respuestas)
- **Requiere:** Aprobacion desde CRM funcional (Etapa 6 consolidada, Fase 3.2)
- **Ideal:** RFC-001 (preprocesamiento media) para evaluar respuestas a mensajes con media
- **Bloquea:** Nada, pero reduce drasticamente la carga del operador

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### 2026-02-20 - gviollaz

Necesitamos esto urgente. En las noches y fines de semana se acumulan mensajes sin responder. Si pudieramos auto-aprobar los saludos y consultas basicas de cursos, mejorariamos mucho la experiencia. Empecemos conservadores: solo auto-aprobar cuando la confianza es MUY alta y el tema es seguro.

### 2026-02-20 - Claude Opus 4.6 (Claude Code)

Recomendacion de implementacion gradual:

**Fase A (semana 1):** Solo agregar scoring, NO auto-aprobar nada. El evaluador corre en paralelo y graba el score. Comparar con las decisiones del operador para calibrar el threshold.

**Fase B (semana 2-3):** Activar auto-aprobacion con threshold 95+ para horarios no laborales (22:00-08:00).

**Fase C (semana 4+):** Bajar threshold gradualmente segun precision medida. Agregar mas horarios.

Esto permite medir antes de actuar y reduce el riesgo a casi cero.

Pregunta abierta: Deberiamos tener un "modo shadow" donde el evaluador califica pero no auto-aprueba, para generar datos historicos y calibrar?

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-02-20 | Claude Opus 4.6 | Creacion del RFC |
| 2026-02-20 | gviollaz | Contexto de negocio y prioridad |
