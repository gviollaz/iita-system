# Informe de Arquitectura  IITA CRM
**Fecha:** 2026-02-21  
**Autor IA:** Software Architect GPT (GPT-5.2 Thinking)  
**Revisado por:** _(pendiente)_  

## Alcance del análisis
Este informe evalúa la razonabilidad y coherencia de la arquitectura **según la documentación y el código presente en este repositorio**:
- Docs: `docs/architecture/*`, `docs/make-pipeline/*`, `docs/features/ROADMAP.md`, `docs/bugs/BUGS-CONOCIDOS.md`, `docs/proposals/*`
- Edge Functions: `database/edge-functions/*`

No incluye auditoría de infraestructura de Supabase en vivo, ni revisión del repo externo del frontend (subtree) más allá de lo incluido aquí.

---

## Resumen ejecutivo (veredicto)
La arquitectura es **coherente y razonable** para un CRM multicanal con IA, especialmente por:
- Modelo data-first centrado en `interactions` como unidad atómica.
- Idempotencia por `external_ref` y uso de RPCs/triggers como invariantes de datos.
- Pipeline de Make.com claramente segmentado en etapas.

**Riesgo crítico actual (P0):** la frontera de confianza está abierta:
- Edge Functions con `verify_jwt: false` (según BUG-011) y CORS `*`.
- Uso de `SUPABASE_SERVICE_ROLE_KEY` (acceso total) en endpoints invocables por HTTP.
- Exposición de un CRUD genérico por `{action, table}` que permite operar cualquier tabla.
- `create-test-user` contiene credenciales hardcodeadas (si se despliega públicamente, es un vector inmediato de abuso).

Conclusión: el diseño funcional está bien, pero **la seguridad perimetral es hoy el principal riesgo sistémico**.

---

## Arquitectura actual (según docs)
### Componentes
- **Canales**: WhatsApp Cloud API, WhatsApp Coexistence, Instagram, Messenger, Email.
- **Orquestación**: Make.com con pipeline de 8 etapas y ~117 escenarios totales (43 activos).
- **Datos**: Supabase PostgreSQL 17 con tablas, funciones RPC y triggers.
- **API**: Edge Functions (Deno), principalmente `crm-api`.
- **Frontend**: React 19 + Vite 6.

### Flujo de mensajes (alto nivel)
- Entrante: canal  Make webhook  `crm-api`  RPC `process_incoming_message`  trigger/webhook  Make (preproceso/IA)  aprobación (CRM)  envío.
- Saliente desde CRM: frontend  `crm-api`  inserta interacción `new`  triggers  Make envía.
- Eco (respuestas desde Meta): Make  RPC `process_echo_message`  guarda interacción saliente `send` + trigger anti-duplicado.

---

## Lo más sólido y coherente (fortalezas)
### 1) interactions como núcleo + dirección exclusiva
El patrón de una interacción es entrante o saliente, no ambas reduce ambigüedad y errores de reporting. Es una decisión de modelado típicamente correcta para CRMs multicanal.

### 2) Invariantes críticas en DB (RPC + triggers)
Mover idempotencia y anti-duplicados a DB (en vez de depender de Make) es una buena práctica: Make reintenta, hay carreras, y el DB es quien mejor puede garantizar unicidad.

### 3) Pipeline por etapas
El pipeline en 8 etapas separa responsabilidades (ingesta, procesamiento, preproceso, IA, evaluación, aprobación, envío, etc.). Esto hace que el sistema sea operable y extensible.

---

## Hallazgos críticos (riesgos y coherencia)
### P0  Frontera de confianza y privilegios excesivos en Edge Functions
**Observación:** `crm-api` y `courses-crud` implementan un CRUD genérico por nombre de tabla usando `SUPABASE_SERVICE_ROLE_KEY` y con CORS `*`.  
**Riesgo:** si la URL se filtra (o se enumera), un atacante podría leer/modificar datos sensibles (25K+ personas) sin fricción.  
**Impacto:** exposición de PII, alteración de conversaciones, borrados/soft-deletes, manipulación de cursos y métricas.

**Nota de coherencia:** aunque se active `verify_jwt: true`, si el backend sigue consultando con service role, **RLS deja de ser control efectivo** (el service role bypassa RLS). Esto significa que login + RLS no es suficiente si no se separa el patrón de acceso.

### P0  `create-test-user` (credenciales hardcodeadas)
La Edge Function para test crea un usuario con email/password fijo. Si esta función está desplegada en un entorno accesible, es un vector directo para:
- creación/validación de sesiones,
- enumeración de auth,
- abuso operativo (y además puede confundir auditorías).

Esto es normal como utilidad de dev, pero **debe estar aislada por ambiente o removida de producción**.

### P1  RLS permisivo
Se documentan ~30 policies con `USING(true)` / `WITH CHECK(true)` (BUG-010).  
Incluso si hoy no están en uso por el bypass de service role, cuando migren a auth real, esto será un hueco serio.

### P1  Complejidad Make.com con techo de mantenimiento
117 escenarios (43 activos) es totalmente viable si hay gobernanza, pero incrementa el costo de:
- debugging distribuido (Make  DB  EF  canales),
- asegurar consistencia de mappings,
- rastrear regresiones.

La documentación y tooling (`make_sync.py`) ayuda, pero a medida que crezca el producto conviene empujar invariantes a DB/RPC y reducir lógica de negocio en Make.

### P2  Resiliencia (eventos vs outbox)
El modelo actual depende de triggers/webhooks a Make. Si Make cae o se atrasan escenarios, pueden quedar colas de `interactions` en estados intermedios.  
Recomendación: sumar un patrón tipo **outbox / retry** (tabla de eventos pendientes + job de reintentos) o al menos un reconciler que detecte estados atascados.

---

## Recomendaciones (acciones concretas)
### 1) Separar Edge Functions por frontera de confianza (P0)
Crear dos familias de endpoints:

**A. API para Frontend (usuario)**
- `verify_jwt: true`
- cliente Supabase con JWT del usuario (no service role) para que RLS funcione.
- endpoints explícitos (sin `{action, table}`).
- autorización por rol/sede (alineado con Fase 4 del roadmap).

**B. API para Webhooks/Make (sistema)**
- autenticación M2M (HMAC / API key rotatoria / allowlist de IP si aplica).
- solo invoca RPCs necesarias (mínimos privilegios).
- no expone tablas arbitrarias.
- CORS irrelevante (no browser).

### 2) Encerrar o eliminar el CRUD genérico (P0)
Si se conserva por velocidad:
- allowlist estricta de tablas + allowlist de columnas por acción,
- deny-by-default,
- auditoría (logging) por request + rate limiting,
- jamás exponerlo a internet sin auth robusta.

### 3) Completar Fase 1 del Roadmap, pero ajustando el cómo
El roadmap actual es correcto en prioridad (login  JWT  whitelist  CORS).  
Mi ajuste técnico: el orden loginJWT está bien, pero **además** se debe:
- dejar de usar service role en endpoints de frontend (o encapsularlo solo en RPCs muy específicas),
- diseñar RLS real para el día en que el frontend opere por usuario.

### 4) Seguridad de Storage (P1)
Bucket `media` público: si contiene adjuntos con PII, migrar a privado + signed URLs (y políticas claras de retención).

### 5) Operabilidad / observabilidad (P2)
- Correlation ID por interacción (propagar `external_ref` como trace id).
- Logging estructurado en Edge Functions (request_id, endpoint, duración, error).
- Dashboard de interacciones atascadas por estado + tarea de reconciliación.

---

## Opinión profesional (cierre)
Como MVP/producción temprana, la arquitectura está bien: **modelo correcto, pipeline entendible, invariantes importantes en DB**.  
El punto débil no es diseño conceptual, sino **seguridad y fronteras de ejecución**: hoy el sistema funciona con un admin API expuesto. Eso es típico en fases iniciales, pero ya está claramente señalado como P0 en la documentación, y debería ser el foco inmediato.

