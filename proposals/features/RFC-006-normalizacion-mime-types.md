# RFC-006: Normalización de Media y MIME Types

- **Fecha:** 2026-02-20
- **Autor IA:** Gemini CLI 2.0
- **Estado:** borrador
- **Prioridad:** P2 (Baja)
- **Relacionado con:** Propuesta #3, RFC-001 (Media IA), FEAT-017 (Storage)

## Contexto

El sistema recibe media de múltiples proveedores (Meta Cloud API, Meta Coexistence, Instagram, Messenger). Messenger, en particular, entrega tipos de media ambiguos como `image` o `file` en lugar de `image/jpeg` o `application/pdf`. Esto causa que el frontend del CRM no pueda determinar el visualizador correcto (Lightbox vs Document Viewer).

## Análisis de Datos Reales

- Tabla `medias` actual: **53 registros** (Sub-representación crítica del uso real).
- Volumen de mensajes Messenger: Bajo (~5-10% del total).
- Problema detectado: Inconsistencia entre el campo `type` de la DB y la extensión real del archivo en `content_dir`.

## Solución Propuesta: Normalización Dinámica

Se propone un enfoque de **Normalización en el Borde (Edge Normalization)** durante la Etapa 3 del pipeline de Make.com.

### 1. Tabla de Mapeo (Opcional pero Recomendada para Control)

Crear una tabla simple en Supabase para centralizar el conocimiento de proveedores:

```sql
CREATE TABLE media_type_mappings (
    id SERIAL PRIMARY KEY,
    provider_name TEXT NOT NULL, -- 'messenger', 'instagram', 'whatsapp'
    original_type TEXT NOT NULL,
    normalized_mime TEXT NOT NULL,
    standard_extension TEXT NOT NULL
);

INSERT INTO media_type_mappings (provider_name, original_type, normalized_mime, standard_extension) VALUES
('messenger', 'image', 'image/jpeg', 'jpg'),
('messenger', 'video', 'video/mp4', 'mp4'),
('messenger', 'file', 'application/octet-stream', 'bin'),
('whatsapp', 'audio/ogg; codecs=opus', 'audio/ogg', 'ogg');
```

### 2. Lógica de Ingesta (Make.com Stage 3)

Antes de insertar en la tabla `medias`, el escenario debe:
1.  Consultar la tabla de mapeo (o usar un `switch` interno si se prefiere no tocar la DB).
2.  Si no hay mapeo, intentar inferir la extensión de la URL (`content_dir`).
3.  Asignar el MIME normalizado al campo `type`.

### 3. Sinergia con RFC-001 (Media IA)

Si se está utilizando una API de Vision (Claude/GPT) para el análisis de media, se debe solicitar al modelo que identifique el tipo de archivo como parte de su output estructurado.

```json
{
  "analysis": "Comprobante de pago...",
  "detected_mime": "image/png",
  "suggested_extension": "png"
}
```

## Beneficios

1.  **Frontend Robusto**: El CRM podrá usar etiquetas `<video>`, `<img>` o enlaces de descarga de forma segura basándose en un MIME type estándar.
2.  **Preparación para Storage (FEAT-017)**: Al migrar a Supabase Storage, contar con el MIME type correcto es obligatorio para que el navegador sirva el archivo con los headers de `Content-Type` adecuados.

## Decisión Recomendada

**No implementar como una tarea aislada.** Integrar esta normalización como parte de la migración a Supabase Storage (FEAT-017). Es ineficiente normalizar MIME types para archivos que todavía se guardan como base64 en la base de datos principal.

---

## Hilo de Discusión

### 2026-02-20 - Gemini CLI 2.0
He analizado el impacto y, dado el bajo volumen de registros en `medias` (53), esta tarea no es prioritaria frente a la seguridad (Fase 1) o la corrección de pérdida de datos (Fase 2). Debe moverse a la Fase 5 (Storage y Performance).
