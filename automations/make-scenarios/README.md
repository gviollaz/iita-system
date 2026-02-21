# IITA Make.com Scenario Sync

Herramienta para exportar, versionar y corregir los escenarios de Make.com del sistema de mensajería de IITA.

## ¿Para qué es este repositorio?

IITA tiene ~117 escenarios en Make.com que forman el pipeline de mensajería automática: recepción de mensajes (Instagram, WhatsApp, Messenger), procesamiento, generación de respuestas con IA, aprobación y envío.

Este repositorio permite:

1. **Exportar** todos los blueprints (JSONs) de los escenarios de Make.com
2. **Versionar** cada snapshot con Git para tener historial de cambios
3. **Corregir** bugs editando los JSONs localmente (o con ayuda de Claude)
4. **Importar** las correcciones de vuelta a Make.com
5. **Comparar** versiones para ver exactamente qué cambió

## Estructura de carpetas

```
iita-make-scenarios/
│
├── make_sync.py          # Script principal (6 comandos)
├── requirements.txt      # Dependencias Python
├── .env                  # Configuración local (token, región, team) — NO se sube a Git
├── .env.example          # Template de configuración
│
├── docs/                 # Documentación del sistema de mensajería
│   ├── 01_documentacion_sistema_mensajeria.md    # Visión general del pipeline
│   ├── 02_doc_tecnica_completa.md                # Doc técnica detallada (Etapas 1-5, blueprints, bugs)
│   └── 03_analisis_flujos_entrada.md             # Análisis de flujos de entrada + plan de mejoras
│
├── snapshots/            # Snapshots de producción (exportados con 'export')
│   └── 2026-02-18_produccion/
│       ├── manifest.json
│       ├── 1_entrada/          # Escenarios [INPUT]
│       ├── 2_procesamiento/    # Create new interaction/conversation
│       ├── 3_preprocesamiento/ # Media Analysis
│       ├── 4_generacion/       # Generate AI response
│       ├── 5_evaluacion/       # (futuro)
│       ├── 6_aprobacion/       # Google Sheets approval
│       ├── 7_envio/            # [OUT] dispatchers y envío
│       └── 8_otros/            # Escenarios no categorizados
│
└── fixes/                # Carpetas de corrección (preparadas con 'prepare-fix')
    └── fix_bugs_p0/      # Ejemplo: corrección de bugs prioritarios
        ├── CHANGELOG.md
        └── (JSONs corregidos)
```

## Instalación

```powershell
# Clonar el repositorio
git clone https://github.com/gviollaz/iita-make-scenarios.git
cd iita-make-scenarios

# Instalar dependencias
pip install -r requirements.txt
```

## Configuración inicial

```powershell
# Opción 1: Pasar el token por variable de entorno y correr setup
$env:MAKE_API_TOKEN="tu-token-de-make-aqui"
python make_sync.py setup

# Opción 2: Copiar el template y editar manualmente
Copy-Item .env.example .env
notepad .env
# Luego correr setup para detectar región y team:
python make_sync.py setup
```

El comando `setup` detecta automáticamente tu región (us1/us2/eu1/eu2), organización y team de Make.com, y guarda todo en `.env`.

## Comandos

### Listar escenarios

```powershell
python make_sync.py list
```

Muestra todos los escenarios agrupados por categoría (entrada, procesamiento, generación, envío, etc.) con su estado (ON/OFF) e ID.

### Exportar snapshot de producción

```powershell
# Exporta a snapshots/YYYY-MM-DD_produccion/
python make_sync.py export

# Exporta a una carpeta específica
python make_sync.py export -o snapshots/pre_fix_caption
```

Descarga todos los blueprints organizados por categoría. Si se corta por rate limiting, volvé a ejecutar el mismo comando — **saltea los que ya se descargaron**.

### Preparar una corrección

```powershell
# Copia escenarios específicos a una carpeta de fix
python make_sync.py prepare-fix -s snapshots/2026-02-18_produccion -i 3730125,4124755 -n fix_bugs_p0
```

Crea la carpeta `fixes/fix_bugs_p0/` con los JSONs seleccionados y un template de CHANGELOG para documentar los cambios.

### Comparar versiones

```powershell
# Muestra qué archivos cambiaron
python make_sync.py diff snapshots/2026-02-18_produccion fixes/fix_bugs_p0

# Con diff detallado línea por línea
python make_sync.py diff snapshots/2026-02-18_produccion fixes/fix_bugs_p0 -v
```

### Importar correcciones a Make.com

```powershell
# Sube los JSONs corregidos a producción (pide confirmación)
python make_sync.py import fixes/fix_bugs_p0

# Sin confirmación (para scripts)
python make_sync.py import fixes/fix_bugs_p0 -y
```

## Flujo de trabajo completo

```powershell
# 1. Exportar estado actual
python make_sync.py export

# 2. Versionar el snapshot
git add snapshots/
git commit -m "Snapshot produccion 2026-02-18"

# 3. Preparar fix con los escenarios a corregir
python make_sync.py prepare-fix -s snapshots/2026-02-18_produccion -i 3730125,4124755 -n fix_caption_bugs

# 4. Editar los JSONs (manual o con ayuda de Claude)
# ... editar fixes/fix_caption_bugs/*.json ...

# 5. Verificar cambios
python make_sync.py diff snapshots/2026-02-18_produccion fixes/fix_caption_bugs

# 6. Importar a Make.com
python make_sync.py import fixes/fix_caption_bugs

# 7. Probar en Make.com que todo funciona

# 8. Exportar nuevo snapshot post-fix
python make_sync.py export -o snapshots/2026-02-18_post_fix_caption

# 9. Versionar todo
git add .
git commit -m "Fix: caption bugs en WA Cloud API y WA Coexistence"
git push
```

## Documentación del sistema

En la carpeta `docs/` están los documentos de evaluación inicial del sistema de mensajería:

| Archivo | Contenido |
|---------|----------|
| `01_documentacion_sistema_mensajeria.md` | Visión general del pipeline, base de datos, canales, estado actual vs ideal |
| `02_doc_tecnica_completa.md` | Documentación técnica detallada: las 5 etapas del pipeline, blueprints analizados, todos los bugs encontrados, propuesta de Etapa 3.5 (evaluación), recomendaciones de mejora priorizadas |
| `03_analisis_flujos_entrada.md` | Análisis específico de los 3 flujos de entrada principales, bugs por flujo, tabla comparativa, plan de mejoras por fases |

## Notas importantes

- **No modificar** IDs de keychains, webhooks ni connections en los JSONs — son IDs internos de Make.com
- El archivo `.env` con el token **nunca se sube a Git** (está en `.gitignore`)
- El script tiene **retry automático** con espera exponencial para errores 429 (rate limiting)
- El script tiene **resume automático** — si se corta el export, volvé a ejecutar y saltea los ya descargados
