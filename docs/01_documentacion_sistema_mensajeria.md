# Documentación del Sistema de Mensajería IITA
## Estado actual — Febrero 2026

---

## 1. Visión general del pipeline

El sistema procesa mensajes entrantes de múltiples canales de comunicación, los almacena en Supabase, genera respuestas con IA, y las envía tras aprobación manual.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE COMPLETO (Make + Supabase)                  │
│                                                                             │
│  ETAPA 1         ETAPA 2              ETAPA 3          ETAPA 4    ETAPA 5  │
│  ─────────       ────────────         ─────────        ────────   ──────── │
│                                                                             │
│  [Instagram] ─┐                                                             │
│  [WhatsApp]  ─┤  Subscenario         Análisis de      Generación  Envío    │
│  [Messenger] ─┼→ "Create new    ──→  conversación ──→ respuesta  ──→ Send  │
│  [WA Coex.]  ─┤  interaction"        + media           (AI)        │       │
│  [Email]     ─┘                                                    │       │
│                  │                                                  │       │
│                  ├─ Busca/crea persona                              │       │
│                  ├─ Busca/crea conversación         ┌──────────────┘       │
│                  ├─ Crea interacción                │                       │
│                  └─ Guarda media (base64)           ▼                       │
│                                               [Google Sheet]               │
│                                               Aprobación manual            │
│                                               (se quiere eliminar)         │
│                                                    │                       │
│                                                    ▼                       │
│                                               [CRM Dashboard]              │
│                                               (reemplazo en desarrollo)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Base de datos (Supabase)

### 2.1 Tablas principales y volúmenes actuales

| Tabla | Registros | Función |
|-------|----------|---------|
| **interactions** | 102,230 | Cada mensaje individual (entrante o saliente) |
| **person_soft_data** | 75,219 | Datos blandos extraídos de personas (intereses, etc.) |
| **conversations** | 25,877 | Conversación = hilo entre persona y sistema |
| **person_conversation** | 25,877 | Lado "persona" de la conversación (1:1 con conversations) |
| **system_conversation** | 25,866 | Lado "sistema" de la conversación (canal asignado) |
| **persons** | 25,556 | Personas/leads únicos |
| **person_contacts** | 21,096 | Datos de contacto de personas (teléfono, email, etc.) |
| **ai_interaction** | 11,920 | Respuestas generadas por IA vinculadas a interacciones |
| **interaction_medias** | 44 | Relación interacción ↔ media |
| **medias** | 44 | Archivos multimedia |
| **channels** | 11 | Canales de comunicación configurados |
| **channel_providers** | 5 | Proveedores (instagram, whatsapp, messenger, email, whatsapp cloud api) |
| **branches** | 2 | Sedes (Salta, San Lorenzo Chico) |
| **ads** | 17 | Anuncios vinculados a cursos |

### 2.2 Ciclo de vida del campo `status`

```
new → preprocessed → processed → pending_delivery → sending → send
```

### 2.3 Canales configurados

| ID | Nombre | Provider | Address | Sede |
|----|--------|----------|---------|------|
| 6 | IITA Salta - Instagram | instagram | 17841404168256335 | Salta |
| 7 | IITA San Lorenzo chico - Instagram | instagram | 17841455198100771 | San Lorenzo Chico |
| 8 | IITA Salta - Messenger | messenger | 296373163870909 | Salta |
| 9 | IITA San Lorenzo Chico - Messenger | messenger | 106307535517599 | San Lorenzo Chico |
| 10 | Chatbot (Cloud API) | whatsapp cloud api | 111869345312688 | Salta |
| 1 | IITA Administracion | whatsapp | 5493872550001 | Salta |
| 2 | IITA 3D | whatsapp | 5493875809318 | Salta |
| 4 | IITA San Lorenzo | whatsapp | 5493876844174 | San Lorenzo Chico |
| 11 | IITA Cursos Email | email | cursosiita@gmail.com | Salta |

---

## 3. Problemas de calidad de datos encontrados

| Tipo de external_ref | Cantidad | % del total | Problema |
|---------------------|---------|-------------|---------|
| Válido | 76,533 | 74.9% | OK |
| Vacío ("") | 13,929 | 13.6% | Sin referencia auditable |
| "2" (valor fijo) | 11,608 | 11.4% | Bug de mapping |
| NULL | 160 | 0.2% | Sin referencia |

---

## 4. Estado actual vs Estado ideal

| Aspecto | Estado actual | Estado ideal |
|---------|--------------|--------------|
| **Función** | Recibe, normaliza, descarga media, llama subscenario | Recibe, guarda payload crudo en cola, responde 200 |
| **Media** | Descarga y convierte a base64 inline | Solo guarda URL/referencia; descarga async |
| **Resiliencia** | Si el subscenario falla, se pierde el mensaje | La cola persiste; se puede reprocesar |
| **Idempotencia** | No hay — mensajes se duplican | Verifica external_ref antes de crear |
| **Aprobación** | Google Sheet + CRM Dashboard (duplicado) | Solo CRM Dashboard |

---

## 5. Bugs encontrados

### Bugs críticos (pérdida de datos)

| # | Flujo | Bug | Fix |
|---|-------|-----|-----|
| 1 | WA Cloud API | Caption usa `image.caption` fijo | Cambiar a `{{6.Messages}}` |
| 2 | WA Coexistence SL | Media ID concatena `sticker.id` fuera del `if()` | Reestructurar if() |
| 3 | WA Coexistence SL | Caption guarda `video.id` en vez de `video.caption` | Cambiar a video.caption |

### Inconsistencias entre flujos

| Campo | Instagram | WA Cloud API | WA Coexistence |
|-------|-----------|-------------|----------------|
| person_name | ❌ | ✅ | ✅ |
| ad_id | ❌ | ❌ | ❌ |
| status | ✅ "new" | ✅ "new" | ❌ no envía |
| Msg salientes | ✅ is_echo | ❌ | ✅ statuses |
| Wait for sub | ✅ true | ✅ true | ❌ false |

---

## 6. Próximos pasos recomendados

### Fase 0: Completar documentación
- Exportar y documentar blueprints faltantes

### Fase 1: Fixes urgentes
- Corregir 3 bugs de caption y media ID
- Agregar `person_name` a Instagram
- Unificar campos inconsistentes

### Fase 2: Cola de mensajes
- Crear tabla `message_queue` en Supabase
- Simplificar flujos de entrada

### Fase 3: Eliminar Google Sheet
- Migrar aprobación al CRM Dashboard

### Fase 4: Optimizar media
- Subir archivos a Supabase Storage en vez de base64

---

*Documento generado el 17 de febrero de 2026*
