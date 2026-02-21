# IITA CRM — Documentación Frontend

> **Última actualización:** 2026-02-18 · **Versión:** 0.1.0 · **Stack:** React 19 + Vite 6

---

## ¿Qué es este proyecto?

CRM (Customer Relationship Management) interno del **Instituto de Innovación y Tecnología Aplicada (IITA)**, con sede en Salta, Argentina. Gestiona conversaciones multicanal (WhatsApp, Instagram, etc.), contactos, cursos y respuestas de IA para la comunicación con alumnos y prospectos.

### Funcionalidades principales

- **Dashboard** — KPIs en tiempo real: total conversaciones, mensajes, contactos, sin responder, volumen por canal/proveedor, mensajes/día (gráfico), top leads
- **Conversaciones** — Chat bidireccional con historial completo, filtros por sede/canal/proveedor/estado/fecha, revisión/aprobación de respuestas IA, envío de mensajes manuales con adjuntos, edición de datos de persona inline
- **Personas** — Listado enriquecido con filtros (país, provincia, curso, teléfono, email), perfil completo con soft data, historial de conversaciones, envío directo de mensajes
- **Cursos** — ABM de cursos, ediciones, horarios. Gestión de estados (Enrolling, Pending, In_Progress, Conclude, Disabled), modalidad presencial/virtual

---

## Estructura del proyecto

```
iitacrm/
├── index.html                  # Entry point HTML
├── vite.config.js              # Vite config con alias @/ → src/
├── package.json                # Dependencies (React 19, Vite 6)
├── .env.example                # Variables de entorno (copiar a .env)
├── src/
│   ├── main.jsx                # ReactDOM.createRoot
│   ├── App.jsx                 # Router principal (tabs: Dashboard, Conversations, People, Courses)
│   ├── index.css               # Estilos globales, CSS variables, dark theme
│   ├── pages/
│   │   ├── Dashboard.jsx       # KPIs y gráficos (19KB)
│   │   ├── Conversations.jsx   # Chat + filtros + AI review (37KB)
│   │   ├── People.jsx          # Personas + perfil + envío mensajes (43KB)
│   │   └── Courses.jsx         # ABM cursos/ediciones/horarios (33KB)
│   ├── components/
│   │   ├── ui.jsx              # Badge, Btn, Loading, Card, Stat, Modal
│   │   ├── Charts.jsx          # BarChart SVG puro (sin dependencias)
│   │   ├── GenericTable.jsx    # Tabla reutilizable con sorting
│   │   └── Lightbox.jsx        # Visor de imágenes/video fullscreen
│   └── lib/
│       ├── api.js              # Cliente API: post() → Edge Function, rpc() → Supabase REST
│       ├── utils.js            # fmtDate, fmtShort, isImage, isVideo, mediaIcon
│       └── useIsMobile.js      # Hook responsive (breakpoint 768px)
└── docs/
    ├── analisis-modelo-mensajeria.md
    ├── FRONTEND.md             # ← Este archivo
    ├── BACKEND.md
    └── CHANGELOG.md
```

---

## Variables de entorno

Copiar `.env.example` a `.env` (o `.env.production` / `.env.development`):

| Variable | Descripción | Ejemplo |
|----------|-------------|--------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://cpkzzzwncpbzexpesock.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anon (pública) de Supabase | `eyJhbGci...` |
| `VITE_API_URL` | URL completa de la Edge Function `crm-api` | `https://cpkzzzwncpbzexpesock.supabase.co/functions/v1/crm-api` |
| `VITE_APP_ENV` | Entorno actual | `production` o `development` |

> **Importante:** Las variables deben empezar con `VITE_` para que Vite las exponga al cliente.

---

## Capa de comunicación (API)

El frontend usa dos mecanismos para comunicarse con el backend:

### 1. `post(body)` — Edge Function `crm-api`

Envía un POST al endpoint de la Edge Function. Soporta dos modos:

**CRUD genérico:**
```js
await post({ action: 'select', table: 'courses', select: '*' })
await post({ action: 'insert', table: 'persons', data: { first_name: 'Juan' } })
await post({ action: 'update', table: 'ai_interaction', data: { evaluation: 'approved' }, id: 123 })
await post({ action: 'delete', table: 'medias', id: 456 })
```

**Endpoints especializados:**
```js
await post({ endpoint: 'chat', params: { conversation_id: 100 } })
await post({ endpoint: 'stats' })
await post({ endpoint: 'send_to_person', params: { person_id: 1, person_address: '5493871234567', channel_id: 5, text: 'Hola' } })
```

### 2. `rpc(fnName, params)` — Supabase REST directo

Llama funciones RPC de PostgreSQL directamente vía REST:
```js
await rpc('get_conversations', { p_search: 'juan', p_limit: 50, p_offset: 0, ... })
await rpc('get_persons_enriched', { p_pais: 'Argentina', ... })
```

---

## Setup local (desarrollo)

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase con el proyecto configurado

### Pasos

```powershell
# 1. Clonar el repositorio
git clone https://github.com/IITA-Proyectos/iitacrm.git
cd iitacrm

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
copy .env.example .env
# Editar .env con los valores correctos

# 4. Iniciar servidor de desarrollo
npm run dev
# → Abre http://localhost:5173
```

---

## Deploy a producción (Vercel)

### Primera vez

```powershell
# 1. Instalar Vercel CLI (si no lo tenés)
npm install -g vercel

# 2. Loguearse
vercel login

# 3. Vincular proyecto (seguir las instrucciones interactivas)
vercel link

# 4. Configurar variables de entorno en Vercel
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_API_URL
vercel env add VITE_APP_ENV
# Para cada una, pegar el valor cuando lo pida

# 5. Deploy
vercel --prod
```

### Deploys subsiguientes

```powershell
# Desde la carpeta del proyecto:
cd C:\ruta\a\iitacrm

# Traer últimos cambios
git pull origin main

# Instalar dependencias (por si hay cambios)
npm install

# Deploy a producción
vercel --prod
```

### Deploy desde GitHub (CI/CD automático)

Si el proyecto está conectado a Vercel via GitHub:
1. Cada push a `main` triggerea un deploy automático
2. Cada push a otras branches crea un preview deployment
3. Para conectar: ir a [vercel.com/new](https://vercel.com/new) → Import Git Repository → seleccionar `IITA-Proyectos/iitacrm`

### Build manual (sin Vercel CLI)

```powershell
npm run build
# Genera carpeta /dist con archivos estáticos
# Subir /dist a cualquier hosting estático (Netlify, S3, etc.)
```

---

## Convenciones de código

- **Sin framework CSS** — Estilos inline con CSS variables definidas en `index.css`
- **Sin router externo** — Navegación por tabs en `App.jsx` con estado local
- **Sin estado global** — Cada página maneja su propio state con `useState`/`useCallback`
- **Alias** — `@/` apunta a `src/` (configurado en `vite.config.js`)
- **Responsive** — Hook `useIsMobile()` para adaptar layout mobile vs desktop

---

## Notas para IA / desarrolladores nuevos

- La Edge Function `crm-api` es el único backend. No hay server propio
- Los datos de persona se guardan en `persons` (datos duros) + `person_soft_data` (datos flexibles como tags de curso)
- Las conversaciones tienen 3 niveles: `conversations` → `person_conversation` (lado persona) + `system_conversation` (lado sistema/canal)
- Las interacciones (mensajes) se vinculan a `person_conversation` (entrantes) o `system_conversation` (salientes), **nunca a ambas**
- Las respuestas IA están en `ai_interaction`, vinculadas al mensaje entrante via `associated_interaction_id`
- Los triggers de PostgreSQL envían webhooks a Make (Integromat) para automatizaciones de envío
- El frontend NO tiene autenticación propia — la Edge Function usa `service_role_key` directamente
