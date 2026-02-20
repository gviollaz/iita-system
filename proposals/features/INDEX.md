# Indice de Propuestas de Mejora (RFCs)

> Las propuestas de mejora (RFCs) son documentos colaborativos donde IAs y humanos pueden proponer, discutir y refinar mejoras al sistema. A diferencia de `proposals/changes/` (cambios de codigo puntuales), estas son **propuestas de producto y arquitectura** que requieren analisis, discusion y planificacion antes de implementar.

## Como usar

1. **Crear nueva propuesta:** Copiar `TEMPLATE.md`, renombrar a `RFC-XXX-descripcion-corta.md`
2. **Discutir:** Agregar comentarios en la seccion "Hilo de discusion" del RFC
3. **Decidir:** Marcar decisiones con `**DECISION:**` en el hilo
4. **Implementar:** Cuando se aprueba, crear las tareas en ROADMAP.md y los cambios en `proposals/changes/`

## Estados

| Estado | Significado |
|--------|-------------|
| `borrador` | Idea inicial, falta completar detalles |
| `en_discusion` | Completo, esperando feedback de IAs y humanos |
| `aprobada` | Aprobada para implementar, pendiente de planificacion |
| `en_desarrollo` | Se esta implementando activamente |
| `implementada` | Completada y en produccion |
| `descartada` | Rechazada con motivo documentado |

## Propuestas activas

| RFC | Titulo | Estado | Prioridad | Componentes |
|-----|--------|--------|-----------|-------------|
| [RFC-001](RFC-001-preprocesamiento-media.md) | Mejorar preprocesamiento de imagenes y archivos adjuntos | en_discusion | P1 | Make.com, Supabase, Edge Functions |
| [RFC-002](RFC-002-evaluacion-aprobacion-automatica.md) | Evaluacion y aprobacion automatica de mensajes IA | en_discusion | P1 | Make.com, Supabase DB, Frontend |
| [RFC-003](RFC-003-control-generacion-respuestas.md) | Control de generacion de respuestas por persona/conversacion | en_discusion | P1 | Frontend, Supabase DB, Make.com |
| [RFC-004](RFC-004-mensajes-masivos-marketing.md) | Mensajes masivos de marketing multicanal | en_discusion | P2 | Frontend, Make.com, Supabase DB |
| [RFC-005](RFC-005-alertas-ventana-24h.md) | Alertas de ventana de 24hs y seguimiento proactivo | en_discusion | P1 | Frontend, Make.com, Supabase DB |

## Propuestas implementadas

(Ninguna todavia)

## Propuestas descartadas

(Ninguna todavia)
