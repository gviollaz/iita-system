# IITA CRM

Proyecto Front End creado con Claude para el CRM de IITA.

Frontend para gestión de personas, comunicaciones, cursos y CRM del sistema IITA.

## Entorno de producción

| | |
|---|---|
| **Proyecto Supabase** | `iita-base` (`cpkzzzwncpbzexpesock`) |
| **Región** | `us-east-1` |
| **Base de datos** | PostgreSQL 17 |
| **Edge Function** | `crm-api` (v9) |
| **URL API** | `https://cpkzzzwncpbzexpesock.supabase.co/functions/v1/crm-api` |

## Stack

- **React 19** + **Vite 6**
- **CSS custom properties** (dark theme)
- **Edge Function API** (`crm-api`) como backend
- **DM Sans** (tipografía)

## Setup

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno para producción
cp .env.example .env.production
# Los valores ya apuntan a producción (iita-base)

# Para desarrollo local
cp .env.example .env.development

# Iniciar servidor de desarrollo
npm run dev

# Build de producción
npm run build
```

## Estructura

```
src/
├── components/
│   ├── ui.jsx              # Badge, Card, Btn, Loading, Toast, TabBar, ErrorBoundary
│   ├── Charts.jsx          # MiniLineChart, MiniBarChart, MiniPieChart
│   ├── GenericTable.jsx    # Tabla con edición inline (ABM)
│   └── Lightbox.jsx        # Visor de imágenes/video
├── lib/
│   ├── api.js              # Cliente API (post, rpc, unwrap)
│   └── utils.js            # Formateo de fechas, números, minutos
├── pages/
│   ├── Dashboard.jsx       # Overview + Análisis por canal
│   ├── Conversations.jsx   # Chat con filtros, medios, evaluación IA
│   ├── Courses.jsx         # ABM de cursos, ediciones, horarios
│   └── People.jsx          # Lista, perfil, edición, estadísticas de personas
├── App.jsx                 # Navegación principal (4 pestañas)
├── main.jsx                # Entry point
└── index.css               # Dark theme CSS
```

## Pestañas

### 📊 Dashboard
- **Resumen general**: KPIs (conversaciones, personas, msgs 24h/7d, sin responder, IA pendiente), gráfico msgs/día, distribución por proveedor (torta), volumen por canal, top leads
- **Análisis por canal**: Filtros por fecha/sede/proveedor/canal con métricas detalladas (entrantes, salientes, pendientes, respuesta IA, tiempos de respuesta)

### 💬 Conversaciones
- Lista con filtros (proveedor, canal, sede, estado, fechas, búsqueda)
- Chat con mensajes entrantes/salientes, medios (imágenes, video, archivos), evaluación IA
- Panel de perfil lateral con datos de la persona

### 📚 Cursos
- ABM completo con 3 sub-tabs: Cursos, Ediciones (con sede y fechas), Horarios

### 👥 Personas
- **Lista**: Búsqueda por nombre/teléfono/ID, filtros por proveedor/sede/teléfono
- **Perfil**: Datos personales, canales de contacto, proveedores/sedes, intereses en cursos, historial de conversaciones
- **Edición**: Formulario inline para modificar datos personales
- **Estadísticas**: KPIs por proveedor, distribución por sede, segmentación para campañas

## API (Edge Function `crm-api`)

La app se conecta a una Edge Function unificada que centraliza todas las consultas.

### Endpoints CRM
| Endpoint | Descripción |
|---|---|
| `stats` | KPIs generales del CRM |
| `msgs_per_day` | Mensajes por día (últimos N días) |
| `volume_by_channel` | Volumen por canal con métricas detalladas |
| `volume_by_provider` | Volumen agrupado por proveedor |
| `top_leads` | Leads con más actividad |
| `unanswered` | Conversaciones sin responder |
| `conversations` | Lista de conversaciones con filtros |
| `chat` | Detalle de una conversación con mensajes, IA, medios |
| `channels` | Lista de canales |
| `branches` | Lista de sedes |

### Endpoints Personas
| Endpoint | Descripción |
|---|---|
| `persons_list` | Lista paginada con canales enriquecidos |
| `persons_stats` | Estadísticas de segmentación |
| `person_full` | Perfil completo con canales, intereses, tickets |
| `person_detail` | Detalle vía RPC |
| `search_persons` | Búsqueda por texto |
| `person_conversations` | Conversaciones de una persona |
| `update_person` | Actualizar datos de persona |

### CRUD genérico
Soporta operaciones `select`, `insert`, `update`, `delete`, `soft_delete` sobre cualquier tabla.

## RPCs de base de datos

| Función | Uso |
|---|---|
| `get_crm_stats` | Estadísticas generales |
| `get_conversations` | Conversaciones con filtros (proveedor, canal, sede, estado, fechas) |
| `get_msgs_per_day` | Mensajes por día |
| `get_volume_by_channel` | Análisis por canal |
| `get_volume_by_provider` | Análisis por proveedor |
| `get_top_leads` | Top leads |
| `get_unanswered_conversations` | Sin responder |
| `get_channel_analysis` | Análisis detallado por canal |
| `get_person_detail` | Detalle de persona |
| `search_persons` | Búsqueda de personas |

## Schema de producción (tablas principales)

| Tabla | Registros | Descripción |
|---|---|---|
| `persons` | 3,642 | Personas/leads |
| `conversations` | 3,480 | Conversaciones |
| `interactions` | 21,656 | Mensajes |
| `ai_interaction` | 5,113 | Respuestas IA |
| `courses` | 40 | Cursos |
| `course_editions` | 98 | Ediciones de cursos |
| `channels` | 10 | Canales de comunicación |
| `branches` | 2 | Sedes (Centro, San Lorenzo) |
