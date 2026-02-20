# Pipeline de Make.com — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

## Pipeline en 8 etapas

```
Etapa 1: ENTRADA (webhooks reciben mensajes de canales)
Etapa 2: PROCESAMIENTO (crea persona/conversacion/interaccion via RPC)
Etapa 3: PREPROCESAMIENTO (analisis de media: imagenes→GPT-5.2, audio→transcripcion)
Etapa 4: GENERACION IA (Claude genera respuesta → ai_interaction pending)
Etapa 5: EVALUACION (propuesto, no implementado completamente)
Etapa 6: APROBACION (CRM Dashboard o Google Sheets legacy)
Etapa 7: ENVIO (dispatchers envian por canal original)
Etapa 8: OTROS (monitoreo, logging, limpieza)
```

## Escenarios clave

| ID | Nombre | Funcion | Estado |
|----|--------|---------|--------|
| 4097069 | WA Cloud API Entry | Entrada WhatsApp Cloud | Activo |
| 4161348 | WA Coexistence Entry | Entrada WhatsApp Coex | Activo |
| 4132732 | Media Analysis | Analisis de media | Activo |
| 4132827 | AI Response Generation | Generacion respuesta IA | Activo |
| 3730125 | Processing Subscenario | Procesamiento central | Activo |
| 3502129 | Google Sheets Approval | Aprobacion legacy | A deprecar |
| 4105815 | Media Analysis (dev) | **BUG: apunta a DB dev** | Error |

## AI Agent "Ana"

- **ID Make.com:** d5568d5f-072d-410a-8c60-2cc48e944525
- **Rol:** Atencion al cliente y asesor de cursos de IITA
- **Modelo:** Claude (via Make.com)

## Herramienta de gestion

```bash
cd automations/make-scenarios/
python make_sync.py list          # Ver escenarios
python make_sync.py export        # Exportar a snapshots/
python make_sync.py prepare-fix   # Preparar correcciones
python make_sync.py diff          # Comparar versiones
python make_sync.py import        # Importar correcciones
```
