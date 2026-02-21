# Análisis de Datos — Base de Datos Legacy

Última actualización: 2026-02-21 | Análisis contra datos de producción  
Período de datos: mayo 2024 – diciembre 2025 (19 meses)

---

## 1. Volumetría General

| Métrica | Valor |
|---------|-------|
| Personas registradas | 22,005 |
| Conversaciones | 22,423 |
| Mensajes (interacciones) | 80,782 |
| Sugerencias IA generadas | 20,615 |
| Logs IA detallados | 22,981 |
| Requests IA a OpenAI | 19,116 |
| Archivos media | 7,366 |
| Contactos importados (agenda) | 13,845 |
| Tamaño total de la base | ~680 MB |

---

## 2. Personas

### Tasa de llenado de campos

| Campo | Llenado | % | Observación |
|-------|---------|---|-------------|
| phone_number | 21,978 | 99.9% | Identificador principal real |
| region | 13,846 | 62.9% | Desde importación de contactos |
| first_name | 5,602 | 25.5% | Nombre capturado por chatbot o importación |
| last_name | 1,572 | 7.1% | Muy poco usado |
| email | 228 | 1.0% | Rara vez recopilado |
| dni | 120 | 0.5% | Solo alumnos formalizados |
| birthday | 41 | 0.2% | Prácticamente sin uso |

**Hallazgo:** El 74.5% de personas son "fantasma" — solo tienen número de teléfono, sin nombre ni datos adicionales. Esto es consistente con un sistema basado en WhatsApp donde muchos contactos nunca interactúan más allá de un mensaje inicial.

### Relación personas vs contactos importados

- 22,005 personas en core_persons
- 13,845 contactos en tabla contactos (importación agenda)
- 20,613 perfiles en core_person_profile (93.7% de personas tienen perfil)
- 20,653 canales en core_person_channels (93.9% tienen canal normalizado)

---

## 3. Conversaciones y Mensajes

### Volumen mensual estimado

| Período | Mensajes/mes (aprox.) |
|---------|----------------------|
| May-Dic 2024 (8 meses) | ~4,000/mes |
| Ene-Dic 2025 (12 meses) | ~4,000/mes |
| **Promedio general** | **~4,250/mes** |

### Distribución por sender

| Sender | Cantidad | % |
|--------|----------|---|
| person (entrante) | 41,058 | 50.8% |
| respondent (saliente) | 39,724 | 49.2% |

Ratio entrada/salida: 1.03:1 — equilibrio casi perfecto, lo que indica que el sistema responde a casi cada mensaje entrante.

### Estado de mensajes

| Status | Cantidad | % | Significado |
|--------|----------|---|-------------|
| READ (4) | 34,625 | 42.9% | Éxito completo: leído |
| RECEIVED (3) | 34,396 | 42.6% | Entregado pero no leído |
| FAILED (5) | 11,608 | 14.4% | **Fallo de envío** |
| SENT (2) | 110 | 0.1% | En tránsito |
| TO_SEND (1) | 43 | 0.05% | Pendiente (residuos) |

**Hallazgo crítico:** 14.4% de mensajes fallaron. Esto se debe probablemente a:
- Ventana de 24h de WhatsApp expirada (el usuario no escribió en las últimas 24h)
- Números inválidos o bloqueados
- Rate limits del proveedor

### Media adjunta

| Tipo | Cantidad | % de media |
|------|----------|------------|
| Videos (mp4) | 3,618 | 49.1% |
| PDFs | 1,321 | 17.9% |
| Imágenes (jpeg) | 1,227 | 16.7% |
| Audio (ogg/opus) | 912 | 12.4% |
| Documentos Word | 145 | 2.0% |
| Otros | 143 | 1.9% |

9.1% de todos los mensajes incluyen archivos adjuntos. Los videos dominan, lo cual es inusual — posiblemente por el envío de material educativo.

---

## 4. Inteligencia Artificial

### Rendimiento general

| Métrica | Valor |
|---------|-------|
| Total sugerencias IA | 20,615 |
| Exitosas (failed=false) | 6,826 (33.1%) |
| Fallidas (failed=true) | 13,789 (66.9%) |
| Con interacción final enviada | 3,675 (17.8%) |
| Editadas por humano | 2,145 de 22,981 logs (9.3%) |
| Con rating del operador | 3,611 (15.7%) |

**Hallazgo:** La tasa de fallo de IA del 66.9% es alta. Esto indica problemas recurrentes con la API de OpenAI (rate limits, errores) o con la lógica de parsing de respuestas.

### Evolución de modelos

| Modelo | Registros | % |
|--------|-----------|---|
| gpt-3.5-turbo | 4,095 | 17.8% |
| gpt-4o | 12,014 | 52.3% |
| gpt-4.1 | 5,211 | 22.7% |
| ft:gpt-4o-mini (ambas versiones) | 1,661 | 7.2% |

El sistema evolucionó de gpt-3.5-turbo → gpt-4o → gpt-4.1, con experimentos de fine-tuning con gpt-4o-mini.

### Tasa de edición humana

Solo 9.3% de las respuestas fueron editadas antes de enviar, lo que sugiere buena calidad general de las respuestas IA (o baja supervisión).

---

## 5. Perfiles Enriquecidos

### Fuentes de datos

| Source | Registros | % |
|--------|-----------|---|
| contactos_import (solo) | 19,978 | 96.9% |
| + chatbot_ai | 272 | 1.3% |
| + edad_mining | 164 | 0.8% |
| + chatbot_mining | 116 | 0.6% |
| Otros combinados | 83 | 0.4% |

El 97% de perfiles se crearon por importación de contactos. Solo el 3% fue enriquecido con datos de conversaciones.

### Datos de conversión comercial

| Campo | Llenado | Top valor |
|-------|---------|-----------|
| consulta_para | 617 (3.0%) | "hijo" (97%), "propio" (3%) |
| preferencia_modalidad | 533 (2.6%) | "online" (92%), "presencial" (5%) |
| edad_consultada | 437 (2.1%) | Edades de niños/adolescentes |
| nombre_alumno | 131 (0.6%) | — |

**Hallazgo:** La mayoría de consultas (97%) son padres preguntando por cursos para sus hijos, con fuerte preferencia por modalidad online (92%).

---

## 6. Etiquetas (Sistema Dual)

### Sistema original (core_interests + core_personbyinterest)

8,873 asignaciones a 36 intereses. Top 5:

| Interés | Asignaciones |
|---------|-------------|
| robótica educativa | 2,780 |
| animación digital online | 1,293 |
| videojuegos on line | 713 |
| cursos impresión 3d | 653 |
| robótica con arduino | 563 |

### Sistema normalizado (core_tags + core_person_tags)

16,782 asignaciones a 31 tags. Top 5:

| Tag | Tipo | Asignaciones |
|-----|------|-------------|
| Robótica Educativa | curso_interes | 3,726 |
| Robótica con Arduino | curso_interes | 1,852 |
| Animación 3D Blender Online | curso_interes | 1,622 |
| Modelado 3D Fusion 360 | curso_interes | 1,195 |
| Marketing Digital Online | curso_interes | 1,072 |

La migración al sistema normalizado duplicó las asignaciones (8,873 → 16,782) porque incorporó datos de múltiples fuentes (legacy, chatbot AI, importaciones).

---

## 7. Canales y Proveedores

### Proveedores de chat activos

| Proveedor | Canales | Descripción |
|-----------|---------|-------------|
| whatsapp (Meta Cloud API) | 4 | Canal principal — números oficiales de Meta |
| whatsapp_maytapi | 3 | Números personales conectados vía Maytapi |
| whatsapp_coexistence | 1 | IITA 3D — Meta coexistence |
| whatsapp_coexistence - SanLorenzo | 1 | San Lorenzo — Meta coexistence |

**Observación:** El legacy era 100% WhatsApp. Instagram aparece en el código pero no hay datos de Instagram en producción. El sistema actual (iita-base) expandió a Instagram, Messenger y Email.

---

## 8. Hallazgos de Calidad de Datos

### Problemas detectados

1. **Conversaciones nunca cerradas:** `end` y `result` siempre NULL en core_conversations. Las conversaciones se abren pero nunca se cierran formalmente.

2. **person_id en interactions es parcial:** Solo se llena en status=READ (42.9%), no es confiable como FK para "quién envió". Se debe usar `sender` + context.

3. **respondent_id en interactions siempre NULL:** A pesar de existir la FK, nunca se usa. El respondent se trackea a nivel de conversación.

4. **Duplicados en core_interests:** Nombres repetidos (ej. "Blender presencial recordatorio 25-6" aparece 3 veces con ids diferentes).

5. **branch_id incorrecto:** El canal "IITA - San Lorenzo" (id 12) apunta a branch_id=1 (IITA Centro) en lugar de branch_id=2 (IITA San Lorenzo Chico).

6. **core_aiinteractionlog sobredimensionada:** 572 MB para 22,981 registros — los campos `prompt` y `request` almacenan textos extensos generando TOAST de 558 MB.

7. **Tablas vacías diseñadas pero no implementadas:** core_lead_inquiry, core_companiesdata, core_empleado, core_limit, core_rol — esquemas creados pero sin datos.

8. **acepted (typo) siempre true:** El campo `acepted` en core_aiinteractions es siempre true, sugiriendo que no refleja aceptación real sino que se setea automáticamente.

### Datos potencialmente valiosos no migrados

- **Rating y feedback de IA:** 3,611 registros con calificaciones de operadores — dataset útil para evaluación de modelos.
- **Prompts completos:** 22,981 prompts system almacenados — documentación implícita de la evolución del prompt engineering.
- **Historial de modelos:** Trazabilidad completa de qué modelo generó cada respuesta.
