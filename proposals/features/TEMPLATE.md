# RFC-XXX: [Titulo de la mejora]

- **Fecha de creacion:** YYYY-MM-DD
- **Ultima actualizacion:** YYYY-MM-DD
- **Estado:** borrador | en_discusion | aprobada | en_desarrollo | implementada | descartada
- **Prioridad:** P0 | P1 | P2 | P3
- **Autor original:** [nombre humano o IA + modelo]
- **Componentes afectados:** [Frontend | Supabase DB | Edge Functions | Make.com | Nuevo servicio]
- **Ref FEAT:** FEAT-XXX (si ya tiene entrada en FEATURES.md)
- **Ref Roadmap:** Fase X.Y (si ya esta en ROADMAP.md)

---

## Resumen ejecutivo

[2-3 oraciones que expliquen que se quiere lograr y por que es importante. Un lector deberia poder decidir si le interesa leer el resto con solo leer esto.]

## Problema

[Descripcion detallada del problema actual. Incluir datos concretos de produccion si los hay: cuantos registros afecta, que impacto tiene, cuanto cuesta no resolverlo.]

## Solucion propuesta

[Descripcion de alto nivel de la solucion. No codigo todavia, sino la idea general.]

### Opcion A: [nombre]

[Descripcion de una forma de resolverlo]

- **Pros:** ...
- **Contras:** ...
- **Esfuerzo:** Bajo | Medio | Alto
- **Impacto:** Bajo | Medio | Alto | Critico

### Opcion B: [nombre] (si aplica)

[Descripcion alternativa]

## Diseno tecnico

[Detalles tecnicos: tablas nuevas, campos, funciones, endpoints, cambios en Make.com, cambios en frontend. Incluir diagramas si ayudan.]

### Cambios en base de datos

```sql
-- Ejemplo de tablas/campos nuevos
```

### Cambios en Edge Functions

```typescript
// Ejemplo de endpoints nuevos
```

### Cambios en frontend

```jsx
// Ejemplo de componentes nuevos
```

### Cambios en Make.com

[Escenarios nuevos o modificados, modulos afectados]

## Plan de implementacion

| Paso | Descripcion | Componente | Estimacion |
|------|-------------|------------|------------|
| 1 | ... | ... | ... |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| ... | ... | ... |

## Criterios de aceptacion

- [ ] Criterio 1
- [ ] Criterio 2

## Dependencias

- Requiere: [otras RFCs, FEATs, o tareas que deben completarse antes]
- Bloquea: [otras RFCs o FEATs que dependen de esta]

---

## Hilo de discusion

> **Instrucciones:** Cualquier IA o persona puede agregar comentarios aca abajo.
> Formato: `### [Fecha] - [Autor]` seguido del comentario.
> NO borrar comentarios anteriores, solo agregar nuevos.
> Si hay una decision, marcarla con **DECISION:** al inicio.

### YYYY-MM-DD - [Autor original]

Comentario inicial, contexto extra, o preguntas abiertas para la discusion.

---

## Historial de cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| YYYY-MM-DD | [autor] | Creacion del RFC |
