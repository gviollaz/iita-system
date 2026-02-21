# 🔍 Análisis Profundo del Sistema IITA CRM
## Hallazgos, Bugs e Inconsistencias

**Fecha:** 19 de febrero de 2026  
**Alcance:** Base de datos (Supabase), Make.com scenarios (118 blueprints), Edge Function (crm-api v17)  
**Referencia:** Documento de Arquitectura `docs/ARQUITECTURA-SISTEMA.md` (commit 41897fc)

---

## Resumen Ejecutivo

Se investigaron las 8 preguntas abiertas del documento de arquitectura, cruzando información entre la base de datos de producción (`cpkzzzwncpbzexpesock`), los blueprints de Make.com (snapshot del 18/02/2026) y el código fuente de la Edge Function. Se identificaron **4 bugs críticos**, **3 vulnerabilidades de seguridad**, **2 inconsistencias arquitectónicas** y múltiples hallazgos menores.

---

## 1. Escenarios Duplicados de Análisis de Media (Q12.1)

### Hallazgo: BUG CONFIRMADO — Escenario con base de datos incorrecta

Existen **dos escenarios activos con el mismo nombre** `[Prepross] Media Analisis - prod`:

| Escenario | Hook ID | Conexión DB | Delay | Estado |
|-----------|---------|-------------|-------|--------|
| **4105815** | 1872205 ("Analisis de media Desarrollo") | `kacygprzxwysoijsvqdv` (**DESARROLLO**) | 20s | ⚠️ Activo |
| **4132732** | 1881112 ("Pre-Processing - Produccion") | `cpkzzzwncpbzexpesock` (**PRODUCCIÓN**) | 10s | ✅ Correcto |

El trigger de base de datos `Pre-Processing` llama al webhook `afn3xvc6s8mdoalwgyat3qurhf0o0y4p`.

### Problema

El escenario **4105815** está etiquetado como "prod" pero apunta a la **base de datos de desarrollo**. Si ambos escenarios procesan el mismo webhook, podrían generar condiciones de carrera o procesamiento duplicado. Si solo uno recibe datos, el otro es código muerto que confunde.

### Recomendación
**INMEDIATA:** Desactivar el escenario 4105815 o verificar que su webhook no recibe datos de producción.

---

## 2. Mecanismo de Aprobación — Dos Caminos Conflictivos (Q12.2)

### Hallazgo: INCONSISTENCIA CRÍTICA — Dos flujos de aprobación con comportamientos diferentes

#### Camino 1: Función RPC `approve_interaction`
- Webhook por defecto: `fwb5rjoebapd5s7r8r3xatc7kfw6k4s0`
- Actualiza `ai_interaction.evaluation = 'approved'` en la DB
- Cambia `interactions.status = 'pending_delivery'`
- Usa `pg_net.http_post` para disparar Make.com
- **Operación atómica** — todos los cambios en una sola transacción

#### Camino 2: Edge Function `dispatch_approved`
- Webhook: `gebhak7g2shvpfp4dr3ht8ay5oak48nc` (**DIFERENTE**)
- **NO actualiza** `evaluation` en la DB
- Envía payload a Make.com, que crea una **NUEVA** interacción
- Make.com es responsable de actualizar `ai_interaction`

### Problema

Los dos caminos usan **webhooks diferentes** que apuntan a **escenarios diferentes** con **comportamientos distintos**. El Camino 1 actualiza registros existentes; el Camino 2 crea nuevos. No hay indicación clara de cuál usa actualmente el frontend. Si se usan ambos, se generan registros duplicados o inconsistencias en el campo `evaluation`.

### Recomendación
**PRIORITARIA:** Definir cuál es el camino canónico y eliminar el otro. Si el frontend usa la Edge Function, agregar la actualización de `evaluation` allí. Si usa el RPC, eliminar `dispatch_approved`.

---

## 3. Escenarios de Desarrollo Activos en Producción (Q12.3)

### Hallazgo: NO HAY SEPARACIÓN DE AMBIENTES

Escenarios de desarrollo encontrados activos:

| ID | Nombre | Actividad |
|----|--------|-----------|
| 4097260 | Create new conversation (Dev) | Activo |
| 4097381 | Create new interaction (Dev) | Activo |
| 4106306 | Generar interacciones desde Google Sheet (Dev) | Activo |
| 4097317 | Save media into bucket (Dev) | Activo |

**Análisis de canales afectados:**
- Canal 2 (IITA 3D): 82 conversaciones, última actividad 12/02/2026
- Canal 10 (Chatbot): 16,669 conversaciones, última actividad 18/02/2026 — **canal principal**

### Problema

Los escenarios de desarrollo y producción comparten la **misma base de datos**, los **mismos webhooks**, y no existe ningún mecanismo de ruteo por ambiente. Cualquier cambio en un escenario "dev" afecta directamente datos de producción.

### Recomendación
**MEDIANO PLAZO:** Implementar separación de ambientes, idealmente usando la base de datos de desarrollo (`kacygprzxwysoijsvqdv`) exclusivamente para escenarios de desarrollo.

---

## 4. Sistema Dual de Aprobación — Google Sheets + CRM (Q12.4)

### Hallazgo: SISTEMA LEGACY ACTIVO EN PARALELO

Escenarios involucrados:
- **3502129:** Crea registros en Google Sheets (loguea **TODAS** las interacciones)
- **4106306:** Lee aprobaciones desde Google Sheets (Dev) — genera interacciones desde Sheets

### Problema

Ambos sistemas (Google Sheets y CRM) pueden aprobar mensajes **sin coordinación entre ellos**. Potencial para conflictos: un mensaje aprobado en Sheets pero rechazado en CRM, o viceversa. Doble procesamiento posible.

### Recomendación
Si el CRM es el sistema primario, desactivar el flujo de aprobación de Google Sheets (mantener solo el logging si es necesario).

---

## 5. Canal IITA 3D — Discrepancia en Documentación (Q12.5)

### Hallazgo: Canal activo documentado como inactivo

El documento de arquitectura indica que el escenario 3794481 `[INPUT] IITA 3D - WhatsApp Coexistence` está **INACTIVO**.

Sin embargo:
- `manifest.json` muestra `"is_active": true`
- La base de datos tiene 82 conversaciones en el Canal 2 (5493875809318)
- Última actividad: 12/02/2026

### Problema
Error de documentación. El canal está activo y recibiendo tráfico.

### Recomendación
Corregir documentación. Evaluar si el canal necesita los mismos controles que el canal principal.

---

## 6. Módulo de Cursos y Pagos — Sin Implementar (Q12.6)

### Hallazgo: Infraestructura creada pero nunca utilizada

**Tablas vacías (0 registros):**
- `course_members` (inscripciones)
- `payment_tickets`, `payments`, `payments_logs`
- `users`, `roles`, `permissions`, `role_permissions`, `branche_users` (sistema RBAC completo)

**Tablas con datos:**
- `courses`: 40 registros
- `course_editions`: 98 registros
- `course_edition_schedule`: 101 registros

### Problema
El catálogo de cursos existe pero el sistema de inscripción/pagos **nunca fue implementado**. El sistema RBAC está completamente vacío — el CRM opera **sin autenticación**.

### Recomendación
**LARGO PLAZO:** Implementar RBAC antes de exponer el CRM a más usuarios. Las tablas ya existen.

---

## 7. Origen de `person_soft_data` — Migración Masiva (Q12.7)

### Hallazgo: Datos de importación bulk, no generados por el sistema

**TODOS** los 75,211 registros fueron creados en solo **dos días**:
- 14/02/2026: 71,271 registros
- 17/02/2026: 3,940 registros

**Categorías principales:** `pais` (21,194), `provincia` (17,426), `localidad` (16,184), `tag_curso_interes` (15,726)

### Conclusión
Estos datos provienen de una **importación masiva** (script externo o proceso de migración), **NO** del pipeline de IA durante conversaciones. Esto es relevante para interpretar correctamente las estadísticas de enriquecimiento de contactos.

---

## 8. Typo en Campo de Base de Datos (Q12.8)

### Hallazgo: CONFIRMADO
El campo `channels.descrption` tiene un typo (falta la 'i' → debería ser `description`). Funcional pero incorrecto. Corregir requiere migration + actualización de código frontend/backend.

---

## Bugs Adicionales Descubiertos

### Bug A: 110 Mensajes Atascados en `pending_delivery`

**Todos** de noviembre 5-6, 2024 (más de 1 año).
- Todos tienen `evaluation = NULL` (ni 'pending' ni 'approved')
- Muchos se auto-referencian en `ai_interaction.generated_interaction_id`

**Causa raíz:** Datos históricos de antes de la implementación del workflow de evaluación. **NO es un bug activo** — el sistema actual (diciembre 2025+) funciona correctamente.

### Bug B: 6,755 Evaluaciones NULL — Datos Históricos

**Timeline:**
- Oct 2024 – Sep 2025: Casi TODAS las evaluaciones NULL (6,755 total)
- Oct 2025: Período de transición
- Dic 2025+: Sistema funciona correctamente (solo pending/approved)

**Conclusión:** Las evaluaciones NULL son datos **migrados** de la versión anterior del sistema. El sistema actual opera correctamente.

### Bug C: Mensajes Echo con Texto Fijo

**Confirmado en blueprint:** Los eventos de estado de entrega de WhatsApp se registran con el texto literal `"Respondido desde telefono"` en lugar del contenido real del mensaje.

**Impacto:** El CRM muestra texto placeholder en vez de las respuestas manuales reales. Afecta la legibilidad del historial de conversaciones.

---

## Vulnerabilidades de Seguridad

### 🔴 CRÍTICA: Edge Function sin Autenticación

```
verify_jwt: false
Access-Control-Allow-Origin: *
```

El endpoint CRUD genérico acepta **CUALQUIER nombre de tabla** sin validación:

```typescript
sb.from(table)  // 'table' viene directamente del request body
```

No hay whitelist, no hay validación. **Cualquier persona con la URL puede ejecutar operaciones arbitrarias** en toda la base de datos, incluyendo 25,000+ registros personales.

### 🔴 CRÍTICA: Webhook Hardcodeado y Expuesto

```typescript
const APPROVE_WEBHOOK = 'https://hook.us2.make.com/gebhak7g2shvpfp4dr3ht8ay5oak48nc';
```

El webhook está expuesto en el código fuente. Si alguien lo obtiene, puede **enviar mensajes a cualquier contacto** a través del sistema.

### 🟡 ALTA: N+1 Query en `persons_list`

```typescript
for (const p of (persons || [])) {
  const { data: pcs } = await sb.from('person_conversation')...
  for (const pc of pcs) {
    const { data: sc } = await sb.from('system_conversation')...
```

Con 50 personas por página: ~150 queries en lugar de 3. Impacto en rendimiento significativo a medida que crece la base de datos.

---

## Resumen de Acciones Recomendadas

### Inmediatas (esta semana)
1. ⛔ Desactivar escenario 4105815 (DB incorrecta)
2. 🔒 Implementar autenticación en Edge Function crm-api
3. 🔒 Agregar whitelist de tablas al CRUD genérico
4. 🔒 Mover webhook a variable de entorno
5. 📋 Definir cuál camino de aprobación es el canónico

### Corto Plazo (2-4 semanas)
1. 🔄 Consolidar workflows de aprobación (eliminar un camino)
2. 🔄 Desactivar aprobación por Google Sheets si el CRM es primario
3. 🐛 Corregir captura de texto en mensajes echo
4. ⚡ Optimizar N+1 queries en `persons_list`
5. 📝 Actualizar documentación de IITA 3D

### Largo Plazo (1-3 meses)
1. 🏗️ Implementar sistema RBAC (tablas ya existen)
2. 🧹 Limpiar ~75 escenarios legacy/inactivos
3. 🔀 Implementar separación de ambientes dev/prod
4. 📊 Agregar monitoreo y alertas
5. 🔧 Corregir typo `descrption` en tabla channels

---

## Referencias Técnicas

- **Base de datos producción:** `cpkzzzwncpbzexpesock`
- **Base de datos desarrollo:** `kacygprzxwysoijsvqdv`
- **Edge Function:** crm-api v17 (sin JWT)
- **Blueprints:** `gviollaz/iita-make-scenarios`, `snapshots/2026-02-18_produccion/`
- **Documento base:** `docs/ARQUITECTURA-SISTEMA.md` en repo iita-make-scenarios
