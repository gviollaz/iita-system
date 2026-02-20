# Reporte tecnico integral — Hallazgos de arquitectura, seguridad y diseno CRM con IA

- **Fecha:** 2026-02-20
- **Autor IA:** ChatGPT GPT-5.2-Codex
- **Repositorio analizado:** `gviollaz/iita-system`
- **Alcance:** Documentacion, Edge Functions y consistencia funcional-operativa (sin cambios de infraestructura en produccion)
- **Estado:** informe de analisis

---

## 1) Resumen ejecutivo

El sistema presenta una **base arquitectonica solida** para operacion multicanal (WhatsApp/Instagram/Messenger/Email), con un pipeline claro hacia Supabase y una separacion razonable de responsabilidades entre Make.com, DB y frontend.

Sin embargo, el analisis confirma una brecha importante: **la superficie de ataque actual es alta** por exposicion de Edge Functions con CORS abierto y uso de `service_role` en endpoints genericos, junto con un backlog conocido de hardening (JWT, RLS real, RBAC). En paralelo, existen **riesgos de calidad de datos** en flujos Make.com (captions/media/ad_id/status) que afectan trazabilidad comercial y calidad del contexto para IA.

En terminos de prioridad:

- **Critico inmediato (P0):** control de acceso API (Auth/JWT/CORS/whitelist) y correcciones de perdida de datos activa en Make.com.
- **Alto (P1):** cierre de brechas de seguridad en DB (RLS efectivo), trazabilidad de anuncios y robustez del estado de interacciones.
- **Medio (P2):** performance y deuda tecnica (media base64, N+1, limpieza de escenarios inactivos).

---

## 2) Fortalezas detectadas

1. **Arquitectura documentada de extremo a extremo** con flujo de mensaje y etapas operativas claras.
2. **Modelo relacional coherente** para dominio conversacional (persona, conversacion, interaccion, IA).
3. **Mecanismos anti-duplicado** ya incorporados (conversaciones y ecos), con evidencia de bugs cerrados.
4. **Roadmap estructurado por fases/prioridades**, incluyendo dependencias criticas (ej. login antes de JWT).
5. **Gobernanza documental madura** (bugs, features, migraciones, operaciones y politicas IA).

---

## 3) Hallazgos criticos (P0)

### H-SEC-001 — API demasiado expuesta por CORS abierto + endpoint CRUD generico

**Evidencia tecnica**
- `crm-api` expone `Access-Control-Allow-Origin: "*"`.
- `crm-api` acepta `action` dinamico (`select/insert/update/delete/soft_delete`) y `table` dinamica, ejecutando operaciones directas sobre cualquier tabla que reciba.
- `courses-crud` replica el mismo patron (`*` + CRUD generico).

**Riesgo**
- Escalada de impacto ante abuso: lectura/modificacion transversal de datos sensibles.
- Ampliacion de superficie para automatizacion maliciosa desde clientes no confiables.

**Recomendacion**
1. Reemplazar `*` por allowlist de dominios.
2. Eliminar o encapsular CRUD generico; migrar a endpoints de dominio explicitos.
3. Si se mantiene temporalmente, imponer whitelist estricta de tablas/campos/acciones y validacion de payload.

---

### H-SEC-002 — Uso de `service_role` en funciones de borde sin aislamiento de privilegios por caso de uso

**Evidencia tecnica**
- `crm-api` y `courses-crud` instancian cliente con `SUPABASE_SERVICE_ROLE_KEY`.
- El diseño bypassa RLS por naturaleza del `service_role`.

**Riesgo**
- Cualquier bypass en capa API se transforma en acceso total a datos.
- Debilita defensa en profundidad mientras no exista Auth+RBAC fuerte en frontend/API.

**Recomendacion**
- Reducir privilegio por endpoint: usar `anon`/JWT user context cuando sea posible y reservar `service_role` solo a operaciones internas no expuestas.

---

### H-SEC-003 — Funcion operativa sensible expuesta: creacion de usuario de prueba con credenciales hardcodeadas

**Evidencia tecnica**
- `create-test-user` crea un usuario fijo (`testgv@iita.com.ar`) y password hardcodeado (`TestGV2025!`) y prueba login.

**Riesgo**
- Riesgo operativo y de seguridad si queda desplegada sin controles de entorno/acceso.
- Posible reutilizacion de credenciales y confusion entre ambientes.

**Recomendacion**
- Deshabilitar en produccion o proteger estrictamente por secreto y gating de entorno.
- Rotar credenciales de prueba y remover hardcoding.

---

### H-DATA-001 — Perdida activa de datos en flujos Make.com de entrada

**Evidencia documental consolidada**
- Bugs P0 abiertos: caption WA Cloud, media ID corrupto WA Coexistence, mapeo video.id vs caption, escenario de media apuntando a DB dev.

**Riesgo**
- Deterioro de calidad historica del dataset conversacional.
- Impacto directo en respuesta IA (menos contexto) y en analitica/atencion.

**Recomendacion**
- Ejecutar Fase 2 del roadmap como ventana de estabilizacion urgente antes de nuevas features.

---

## 4) Hallazgos altos (P1)

### H-SEC-004 — Seguridad planificada pero no consolidada (JWT/RLS/RBAC)

El repositorio identifica correctamente los riesgos (JWT deshabilitado, RLS permisivo, necesidad de RBAC), pero el estado actual sigue en transicion.

**Recomendacion**
- Congelar expansiones funcionales no criticas y cerrar primero Fase 1+4 en orden estricto:
  1) Login,
  2) JWT en Edge Functions,
  3) middleware de autorizacion,
  4) RLS por rol/sede.

### H-DATA-002 — Trazabilidad de marketing incompleta (`ad_id/ad_external_ref`)

Sin `ad_id` en todos los flujos no es posible medir ROI por origen de lead de forma confiable.

### H-OPS-001 — Riesgo de deriva entre documentacion y estado real de entorno

Se detectan referencias a componentes/archivos no presentes (ej. `scenarios-analysis.md`) y menciones de configuraciones operativas que no se pueden verificar solo desde repo (ej. `verify_jwt: false` de despliegue).

**Recomendacion**
- Establecer checklist de "doc parity" por release con verificacion automatizable.

---

## 5) Hallazgos medios (P2)

### H-PERF-001 — Deuda de almacenamiento media en base64

El propio roadmap identifica costo/volumen alto en DB por `medias.content_dir` con base64 y necesidad de migrar a Storage URL.

### H-ARCH-001 — Riesgo de mantenimiento por concentracion de logica en `crm-api`

La Edge Function concentra muchas responsabilidades (CRUD, conversaciones, personas, analitica, mensajeria), lo que incrementa riesgo de regresion y dificulta seguridad por dominio.

### H-AI-001 — Brecha entre pipeline y etapa de evaluacion automatica

La etapa 5 de evaluacion IA aun no esta implementada completamente; esto limita escalabilidad y consistencia de criterios.

---

## 6) Inconsistencias y deuda documental detectada

1. **Referencia rota** en README hacia `docs/make-pipeline/scenarios-analysis.md` (archivo no presente).
2. La documentacion de bugs/features describe riesgos de seguridad de entorno productivo, pero parte de esos estados no se auditan desde codigo versionado (necesaria evidencia operativa complementaria).
3. Existen typos historicos en nomenclatura (`descrption`, `confictive`) que conviene mantener por compatibilidad, pero documentar explicitamente para evitar errores de integracion.

---

## 7) Matriz de riesgo (impacto x probabilidad)

| ID | Hallazgo | Impacto | Probabilidad | Prioridad |
|---|---|---|---|---|
| H-SEC-001 | CORS `*` + CRUD generico | Muy alto | Alta | P0 |
| H-SEC-002 | `service_role` expuesto en API generica | Muy alto | Media/Alta | P0 |
| H-SEC-003 | create-test-user hardcodeado | Alto | Media | P0 |
| H-DATA-001 | Perdida activa de datos Make.com | Alto | Alta | P0 |
| H-SEC-004 | JWT/RLS/RBAC incompleto | Muy alto | Media | P1 |
| H-DATA-002 | Falta `ad_id` en flujos | Alto (negocio) | Alta | P1 |
| H-PERF-001 | Media base64 en DB | Medio/Alto | Alta | P2 |
| H-ARCH-001 | `crm-api` monolitico | Medio | Media | P2 |
| H-AI-001 | Evaluacion automatica parcial | Medio | Media | P2 |

---

## 8) Plan de accion recomendado (30-60-90 dias)

### 0-30 dias (bloque seguridad+calidad)
1. Cerrar BUG-001..004 (Make.com P0).
2. Implementar login (FEAT-010) y habilitar JWT progresivamente.
3. Cerrar CORS abierto y bloquear CRUD generico con whitelist temporal.
4. Deshabilitar/asegurar `create-test-user` fuera de desarrollo.

### 31-60 dias (control de acceso robusto)
1. Implementar RBAC por rol+sede (FEAT-011).
2. Reemplazar politicas RLS permisivas.
3. Auditar endpoints por principio de minimo privilegio.

### 61-90 dias (escala y eficiencia)
1. Migrar media a Storage (FEAT-017).
2. Refactor de `crm-api` por bounded contexts.
3. Implementar etapa de evaluacion automatica IA (FEAT-014) con metricas de precision.

---

## 9) KPIs sugeridos para seguimiento ejecutivo

- **Seguridad:**
  - % endpoints protegidos por JWT
  - # tablas con acceso directo por CRUD generico
  - # politicas RLS con `USING(true)`
- **Calidad de datos:**
  - % mensajes con caption correctamente persistido
  - % interacciones con `status` valido al ingreso
  - % mensajes con `ad_id` cuando aplica
- **Operacion IA:**
  - tiempo medio de aprobacion IA
  - ratio aprobada/rechazada por canal
  - ratio auto-aprobada (cuando FEAT-014 se implemente)
- **Performance:**
  - MB consumidos por media en DB vs Storage
  - latencia p95 de endpoints principales

---

## 10) Conclusiones

El sistema ya tiene cimientos correctos para operar un CRM multicanal asistido por IA, pero actualmente convive con una **deuda de seguridad y calidad de datos que debe tratarse como prioridad de continuidad operativa**, no como mejora incremental. El roadmap existente ya apunta en la direccion correcta; la clave es **ejecucion disciplinada por fases** y una politica de "seguridad primero" antes de ampliar funcionalidad.

