# IITA Make Scenarios — Changelog

---

## [2026-02-20] — An&aacute;lisis de pipeline IA y documentaci&oacute;n

**Estado: Documentaci&oacute;n solamente, sin cambios en escenarios**

### An&aacute;lisis completado

Se analizaron en detalle los dos escenarios principales del pipeline de IA:

- **4132827** (`rg_generate_ai_response_-_prod`): Generaci&oacute;n de respuestas IA
- **4132732** (`prepross_media_analisis_-_prod`): An&aacute;lisis de media/adjuntos

### Hallazgos principales

1. **Media off-topic genera respuestas inapropiadas:** El system prompt de "Ana" no tiene reglas para manejar im&aacute;genes que no sean comprobantes de pago. Cuando un cliente env&iacute;a un screenshot de redes sociales (ej: post de crypto/scam), la IA genera advertencias de phishing en vez de redirigir a cursos.

2. **An&aacute;lisis de imagen sin contexto CRM:** GPT-5.2 describe la imagen en abstracto. No sabe que viene de un instituto educativo. La descripci&oacute;n detallada del contenido off-topic contamina el contexto de Ana.

3. **Ecos de Instagram/WhatsApp:** Resuelto con trigger en DB (no en Make.com). Los ecos ya no generan interacciones duplicadas.

### Propuestas documentadas (no implementadas)

Ver `docs/ANALISIS-ESCENARIOS-IA.md` para detalle completo:

| Nivel | Propuesta | Escenario | Esfuerzo | Impacto |
|-------|-----------|-----------|----------|---------|
| 1 | Reglas de media en system prompt | 4132827 | Bajo | Alto |
| 2 | Clasificaci&oacute;n de imagen en an&aacute;lisis | 4132732 | Medio | Medio |
| 3 | Re-encuadrar label media en SQL | 4132827 | Bajo | Bajo |

---

## [2026-02-19] — An&aacute;lisis profundo del sistema

**Estado: Documentaci&oacute;n, sin cambios en escenarios**

### Hallazgos documentados (commit `9f47a6f`)

- Mapeado completo de 43 escenarios activos en 8 etapas del pipeline
- Identificados bugs P0 en escenarios de entrada:
  - P0-1: Caption perdido en WA Cloud API (4097069, mod 8)
  - P0-2: Media ID corrupto en WA Coexistence (4161348, mod 6)
  - P0-3: `video.id` vs `video.caption` (4161348, mod 7)
  - P0-4: Escenario 4105815 apunta a DB dev
- Documentado sistema de aprobaci&oacute;n dual (Google Sheets legacy vs CRM)
- Propuesto deprecar flujo Google Sheets (escenario 3502129)

---

## [2026-02-18] — Export de producci&oacute;n

### Snapshot `2026-02-18_produccion` (commit `0c29230`)

Export completo de todos los escenarios activos organizados por etapa:
- `1_entrada/`: 7 escenarios de webhooks de entrada
- `2_procesamiento/`: 7 escenarios de creaci&oacute;n de personas/conversaciones/interacciones
- `3_preprocesamiento/`: 1 escenario de an&aacute;lisis de media
- `4_generacion/`: 1 escenario de generaci&oacute;n IA
- `6_aprobacion/`: 3 escenarios (Google Sheets legacy)
- `7_envio/`: 16 escenarios de dispatchers por canal
- `8_otros/`: Escenarios auxiliares

### Snapshot `2026-02-19_nocturno` (commit `3401902`)

Export nocturno para tracking de cambios.

---

## Bugs pendientes por prioridad

### P0 — Inmediato (p&eacute;rdida de datos activa)

| Bug | Escenario | Detalle |
|-----|-----------|---------|
| Caption WA Cloud API | 4097069, mod 8 | `image.caption` hardcoded, no usa `{{6.Messages}}` |
| Media ID WA Coex | 4161348, mod 6 | `if()` concatena sticker ID fuera de condici&oacute;n |
| video.id vs video.caption | 4161348, mod 7 | Extrae ID del video en vez del caption |
| DB dev en prod | 4105815 | Escenario de media analysis apunta a base de datos de desarrollo |

### P1 — Consolidaci&oacute;n

| Bug | Escenario | Detalle |
|-----|-----------|---------|
| Falta person_name en IG | Flujos Instagram | No se extrae nombre del perfil |
| Falta ad_id | Todos los flujos | Campo de publicidad no se env&iacute;a |
| Falta status default | WA Coexistence | No setea `new` como status default |
| Echo text hardcoded | Varios | "Respondido desde telefono" en vez de texto real |
| Google Sheets legacy | 3502129 | Sistema dual de aprobaci&oacute;n a deprecar |
