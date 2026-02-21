# Documentación del Sistema de Mensajería IITA

Esta carpeta contiene la documentación técnica del sistema de mensajería automatizada de IITA, generada a partir del análisis de blueprints de Make.com y la base de datos de Supabase en febrero de 2026.

## Archivos

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `01_documentacion_sistema_mensajeria.md` | Visión general del pipeline, modelo de datos en Supabase, canales configurados, problemas de calidad de datos, comparación estado actual vs ideal |
| 2 | `02_doc_tecnica_completa.md` | **Documento principal.** Documentación técnica exhaustiva de las 5 etapas del pipeline (entrada → procesamiento → preprocesamiento → generación AI → aprobación → envío), con diagramas de flujo detallados, análisis de cada módulo, inventario completo de 12 bugs, propuesta de Etapa 3.5 (evaluación automática), y recomendaciones de mejora priorizadas en 6 fases |
| 3 | `03_analisis_flujos_entrada.md` | Análisis detallado de los 3 flujos de entrada principales (Instagram, WA Cloud API, WA Coexistence), con hallazgos por flujo, tabla comparativa cruzada, correcciones inmediatas con código, y plan de mejoras en 4 fases |

## Estado del análisis

- **117 escenarios** identificados en Make.com (43 activos, 74 inactivos)
- **18 escenarios de producción** documentados en detalle
- **12 bugs** catalogados (3 P0, 5 P1 datos, 4 P1 arquitectura)
- **6 fases de mejora** propuestas y priorizadas

## Fecha de generación

Febrero 2026 — Basado en blueprints exportados y datos de Supabase proyecto `cpkzzzwncpbzexpesock`
