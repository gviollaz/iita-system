# Sistema Legacy — Chatbot IITA 2.0

Ultima actualizacion: 2026-02-21 | Autor: gviollaz + Claude Opus 4.6

## Que es esto

Esta carpeta contiene la documentacion tecnica del **Chatbot IITA 2.0**, el sistema anterior que fue reemplazado por el actual `iita-system`. Los datos que hoy estan en Supabase fueron migrados desde este sistema.

## Por que se reemplazo

El Chatbot IITA 2.0 era un sistema monolitico Django + Flask desplegado en una VM propia con PostgreSQL local. Si bien funcionaba correctamente, presentaba limitaciones que motivaron la migracion:

- **Infraestructura:** Dependia de una VM con deploy manual (gunicorn + nginx), sin CI/CD ni alta disponibilidad.
- **Escalabilidad:** El motor asincrono usaba threads in-process con lock global, lo que generaba condiciones de carrera con multiples workers.
- **Frontend:** UI basada en Django templates + HTMX + polling cada 2 segundos, dificil de extender.
- **Automatizaciones:** La logica de envio/recepcion estaba acoplada al codigo Python. Ahora Make.com maneja esa orquestacion de forma mas flexible.
- **Base de datos:** PostgreSQL local sin backups automaticos ni API REST. Supabase resuelve ambos.

## Que se migro

Durante la transicion (febrero 2026) se migraron:

- ~25,000 personas/contactos (`Persons` → `persons`)
- ~102,000 interacciones/mensajes (`Interactions` → `interactions`)
- ~24,000 conversaciones (`Conversations` → `conversations`)
- ~12,000 respuestas IA (`AIInteractions` → `ai_interaction`)
- Cursos y ediciones (`Courses`/`CourseEdition` → `courses`/`course_editions`)
- Etiquetas/intereses (`Interests`/`PersonByInterest` → `interests`/`person_interest`)

## Donde esta el codigo fuente

El codigo fuente del sistema legacy se mantiene en su repositorio original:

| Repositorio | Descripcion | Estado |
|-------------|-------------|--------|
| [`IITA-Proyectos/chatbot`](https://github.com/IITA-Proyectos/chatbot) | Codigo fuente completo (Django + Flask + servicios) | Archivado (ultimo push: nov 2025) |

> **Nota:** No se incluye el codigo fuente en este repositorio para evitar duplicacion. La documentacion tecnica en esta carpeta es suficiente para entender la arquitectura y tomar decisiones informadas sobre el sistema actual.

## Documentacion disponible

| Archivo | Descripcion |
|---------|-------------|
| [chatbot-v2-documentacion-completa.md](chatbot-v2-documentacion-completa.md) | Documentacion tecnica completa: arquitectura, modelos, APIs, deployment, diagramas Mermaid |

## Comparacion rapida: Legacy vs Actual

| Aspecto | Chatbot IITA 2.0 (legacy) | IITA System (actual) |
|---------|---------------------------|----------------------|
| Backend | Django 5.1 + Flask 3 (Python) | Make.com + Edge Functions (Deno) |
| Base de datos | PostgreSQL local en VM | PostgreSQL 17 en Supabase |
| Frontend | Django templates + HTMX + polling | React 19 + Vite 6 |
| IA | OpenAI (in-process threads) | OpenAI + Claude (via Make.com) |
| Mensajeria | Adaptadores Flask por canal | Webhooks Make.com |
| Deploy | gunicorn + nginx en VM | Vercel (frontend) + Supabase (DB/API) + Make.com |
| Canales | WhatsApp, Instagram | WhatsApp, Instagram, Messenger, Email |
| Repo | `IITA-Proyectos/chatbot` | `gviollaz/iita-system` + `IITA-Proyectos/iitacrm` |
