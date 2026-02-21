#!/usr/bin/env python3
"""
IITA Make.com Scenario Sync Tool
=================================
Exporta e importa blueprints de escenarios Make.com desde/hacia carpetas locales.

Uso:
    python make_sync.py setup          # Configuracion inicial (detecta region y team)
    python make_sync.py list           # Lista todos los escenarios
    python make_sync.py export         # Exporta snapshot con fecha de hoy
    python make_sync.py export -o mi_carpeta  # Exporta a carpeta especifica
    python make_sync.py import fixes/2026-02-18_fix_bugs_p0  # Importa JSONs corregidos
    python make_sync.py diff snapshots/2026-02-18 fixes/2026-02-18_fix  # Compara dos carpetas

Requisitos:
    pip install requests python-dotenv

Configuracion:
    Crear archivo .env con:
        MAKE_API_TOKEN=tu-token-aqui
        MAKE_REGION=us1          (se detecta automaticamente con 'setup')
        MAKE_TEAM_ID=12345       (se detecta automaticamente con 'setup')
"""

import os
import sys
import json
import time
import argparse
import datetime
import difflib
from pathlib import Path

try:
    import requests
except ImportError:
    print("Falta el paquete 'requests'. Instalalo con: pip install requests")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

MAKE_API_TOKEN = os.environ.get("MAKE_API_TOKEN", "")
MAKE_REGION = os.environ.get("MAKE_REGION", "")
MAKE_TEAM_ID = os.environ.get("MAKE_TEAM_ID", "")
REGIONS = ["us1", "us2", "eu1", "eu2"]

# Rate limiting: delay between API calls in seconds
API_DELAY = 1.0
# Retry config for 429 errors
MAX_RETRIES = 3
RETRY_BASE_DELAY = 10  # seconds, doubles each retry

CATEGORY_PATTERNS = {
    "1_entrada": ["[input]", "input_", "entrada"],
    "2_procesamiento": ["create new interaction", "create new conversation", "save media"],
    "3_preprocesamiento": ["prepro", "media anali", "media_anali"],
    "4_generacion": ["generate ai", "[rg]", "ai response", "generacion"],
    "5_evaluacion": ["evalua", "quality check", "filter"],
    "6_aprobacion": ["google sheet", "casillero", "aprobacion"],
    "7_envio": ["sending", "[out]", "dispatcher", "envio", "message dispatch", "approve"],
}

def get_base_url(region=None):
    r = region or MAKE_REGION
    return f"https://{r}.make.com/api/v2"

def get_headers(token=None):
    t = token or MAKE_API_TOKEN
    return {"Authorization": f"Token {t}", "Content-Type": "application/json"}

def api_get(endpoint, params=None, region=None, token=None, retry=True):
    url = f"{get_base_url(region)}{endpoint}"
    last_error = None
    attempts = MAX_RETRIES if retry else 1
    for attempt in range(attempts):
        try:
            resp = requests.get(url, headers=get_headers(token), params=params or {}, timeout=30)
            if resp.status_code == 429 and attempt < attempts - 1:
                wait = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"RATE LIMIT, esperando {wait}s...", end=" ", flush=True)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            if resp.status_code == 429 and attempt < attempts - 1:
                wait = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"RATE LIMIT, esperando {wait}s...", end=" ", flush=True)
                time.sleep(wait)
                continue
            last_error = e
            raise
        except Exception as e:
            last_error = e
            raise
    raise last_error

def api_patch(endpoint, data, region=None):
    url = f"{get_base_url(region)}{endpoint}"
    resp = requests.patch(url, headers=get_headers(), json=data, timeout=60)
    if not resp.ok:
        # Show detailed error from Make.com API
        try:
            error_body = resp.json()
            detail = json.dumps(error_body, indent=2, ensure_ascii=False)
        except Exception:
            detail = resp.text[:2000]
        raise Exception(f"{resp.status_code} {resp.reason}\n    Response: {detail}")
    return resp.json()

def categorize_scenario(name):
    name_lower = name.lower()
    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if pattern in name_lower:
                return category
    return "8_otros"

def sanitize_filename(name):
    replacements = {
        " ": "_", "/": "_", "\\": "_", "[": "", "]": "",
        "~": "_", "(": "", ")": "", '"': "", "'": "",
        "\u00e1": "a", "\u00e9": "e", "\u00ed": "i", "\u00f3": "o", "\u00fa": "u",
        "\u00f1": "n", "\u00bf": "", "?": "", "\u00a1": "", "!": "",
        ":": "", ",": "", ";": "", "&": "y",
    }
    result = name.lower()
    for old, new in replacements.items():
        result = result.replace(old, new)
    while "__" in result:
        result = result.replace("__", "_")
    return result.strip("_")

def get_all_scenarios():
    all_scenarios = []
    offset = 0
    limit = 100
    while True:
        params = {"teamId": MAKE_TEAM_ID, "pg[limit]": limit, "pg[offset]": offset}
        data = api_get("/scenarios", params=params)
        scenarios = data.get("scenarios", [])
        all_scenarios.extend(scenarios)
        if len(scenarios) < limit:
            break
        offset += limit
    return all_scenarios

def check_config():
    errors = []
    if not MAKE_API_TOKEN: errors.append("MAKE_API_TOKEN")
    if not MAKE_REGION: errors.append("MAKE_REGION")
    if not MAKE_TEAM_ID: errors.append("MAKE_TEAM_ID")
    if errors:
        print(f"Faltan variables de configuracion: {', '.join(errors)}")
        print("Ejecuta: python make_sync.py setup")
        sys.exit(1)

def cmd_setup(args):
    print("Configuracion inicial de IITA Make Sync")
    print("=" * 50)
    token = MAKE_API_TOKEN
    if not token:
        token = input("\nIngresa tu API Token de Make.com: ").strip()
        if not token:
            print("Token vacio, abortando.")
            return

    print("\nDetectando region de tu cuenta...")
    detected_region = None
    for region in REGIONS:
        try:
            url = f"https://{region}.make.com/api/v2/users/me"
            resp = requests.get(url, headers={"Authorization": f"Token {token}"}, timeout=10)
            if resp.status_code == 200:
                user = resp.json()
                print(f"  OK - Encontrado en {region}: {user.get('name', '?')} ({user.get('email', '')})")
                detected_region = region
                break
            else:
                print(f"  X  {region}: status {resp.status_code}")
        except Exception as e:
            print(f"  X  {region}: {e}")

    if not detected_region:
        print("\nNo pude detectar tu region. Verifica que el token es correcto.")
        return

    print(f"\nBuscando organizaciones en {detected_region}...")
    try:
        orgs_resp = requests.get(
            f"https://{detected_region}.make.com/api/v2/organizations",
            headers={"Authorization": f"Token {token}"}, timeout=10)
        orgs_resp.raise_for_status()
        orgs_data = orgs_resp.json()
        orgs = orgs_data.get("organizations", orgs_data if isinstance(orgs_data, list) else [])
    except Exception as e:
        print(f"Error obteniendo organizaciones: {e}")
        return

    if not orgs:
        print("No se encontraron organizaciones.")
        return

    if len(orgs) == 1:
        org = orgs[0]
        org_id = org.get("id")
        org_name = org.get("name", "sin nombre")
        print(f"  OK - Organizacion: {org_name} (ID: {org_id})")
    else:
        print(f"\n  Se encontraron {len(orgs)} organizaciones:")
        for i, org in enumerate(orgs):
            print(f"  [{i + 1}] {org.get('name', 'sin nombre')} (ID: {org.get('id')})")
        choice = input(f"\n  Elegi una organizacion (1-{len(orgs)}): ").strip()
        try:
            org = orgs[int(choice) - 1]
            org_id = org.get("id")
            org_name = org.get("name", "sin nombre")
        except (ValueError, IndexError):
            print("Opcion invalida.")
            return

    print(f"\nBuscando teams en organizacion {org_name}...")
    try:
        teams_resp = requests.get(
            f"https://{detected_region}.make.com/api/v2/teams",
            headers={"Authorization": f"Token {token}"},
            params={"organizationId": org_id},
            timeout=10)
        teams_resp.raise_for_status()
        teams_data = teams_resp.json()
        teams = teams_data.get("teams", teams_data if isinstance(teams_data, list) else [])
    except Exception as e:
        print(f"Error obteniendo teams: {e}")
        return

    if not teams:
        print("No se encontraron teams.")
        return

    if len(teams) == 1:
        team = teams[0]
        team_id = team.get("id")
        team_name = team.get("name", "sin nombre")
        print(f"  OK - Team: {team_name} (ID: {team_id})")
    else:
        print(f"\n  Se encontraron {len(teams)} teams:")
        for i, team in enumerate(teams):
            print(f"  [{i + 1}] {team.get('name', 'sin nombre')} (ID: {team.get('id')})")
        choice = input(f"\n  Elegi un team (1-{len(teams)}): ").strip()
        try:
            team = teams[int(choice) - 1]
            team_id = team.get("id")
            team_name = team.get("name", "sin nombre")
        except (ValueError, IndexError):
            print("Opcion invalida.")
            return

    print(f"\nVerificando escenarios del team {team_name}...")
    try:
        scenarios_resp = requests.get(
            f"https://{detected_region}.make.com/api/v2/scenarios",
            headers={"Authorization": f"Token {token}"},
            params={"teamId": team_id}, timeout=10)
        scenarios_resp.raise_for_status()
        scenarios = scenarios_resp.json().get("scenarios", [])
        print(f"  OK - {len(scenarios)} escenarios encontrados")
    except Exception as e:
        print(f"  Error contando escenarios: {e}")

    env_path = Path(".env")
    env_content = (
        f"# IITA Make.com Sync - Configuracion\n"
        f"# Generado automaticamente el {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"# Organizacion: {org_name} (ID: {org_id})\n"
        f"# Team: {team_name}\n\n"
        f"MAKE_API_TOKEN={token}\n"
        f"MAKE_REGION={detected_region}\n"
        f"MAKE_TEAM_ID={team_id}\n"
    )

    if env_path.exists():
        overwrite = input(f"\nYa existe .env. Sobrescribir? (s/n): ").strip().lower()
        if overwrite != "s":
            print(f"Configuracion no guardada. Edita manualmente .env")
            print(f"\n  MAKE_REGION={detected_region}\n  MAKE_TEAM_ID={team_id}")
            return

    env_path.write_text(env_content)
    print(f"\nConfiguracion guardada en .env")
    print(f"  Region: {detected_region}")
    print(f"  Organizacion: {org_name} (ID: {org_id})")
    print(f"  Team: {team_name} (ID: {team_id})")
    print(f"\n  Proximo paso: python make_sync.py export")

def cmd_list(args):
    check_config()
    print("Escenarios en Make.com")
    print("=" * 80)
    scenarios = get_all_scenarios()
    by_category = {}
    for s in scenarios:
        cat = categorize_scenario(s["name"])
        by_category.setdefault(cat, []).append(s)
    for cat in sorted(by_category.keys()):
        print(f"\n[{cat}]")
        for s in by_category[cat]:
            active = "ON " if s.get("isActive") else "OFF"
            stype = "TOOL" if s.get("type") == "tool" else "    "
            print(f"  {active} {stype} [{s['id']:>7}] {s['name']}")
    print(f"\n  Total: {len(scenarios)} escenarios")

def cmd_export(args):
    check_config()
    if args.output:
        output_dir = Path(args.output)
    else:
        today = datetime.date.today().isoformat()
        output_dir = Path(f"snapshots/{today}_produccion")

    print(f"Exportando escenarios a {output_dir}/")
    print("=" * 60)
    scenarios = get_all_scenarios()
    print(f"  {len(scenarios)} escenarios encontrados")
    print(f"  Delay entre requests: {API_DELAY}s | Retries en 429: {MAX_RETRIES}\n")

    manifest = {
        "exported_at": datetime.datetime.now().isoformat(),
        "region": MAKE_REGION, "team_id": MAKE_TEAM_ID,
        "scenario_count": len(scenarios), "scenarios": [],
    }
    errors = []
    skipped = 0

    for i, scenario in enumerate(scenarios, 1):
        sid = scenario["id"]
        name = scenario["name"]
        category = categorize_scenario(name)
        filename = f"{sid}_{sanitize_filename(name)}.json"
        is_active = scenario.get("isActive", False)
        s_type = scenario.get("type", "scenario")
        status = "ON " if is_active else "OFF"

        # Check if already exported (resume support)
        category_dir = output_dir / category
        filepath = category_dir / filename
        if filepath.exists():
            print(f"  {status} [{i}/{len(scenarios)}] {name}... SKIP (ya existe)")
            skipped += 1
            manifest["scenarios"].append({
                "id": sid, "name": name, "category": category,
                "filename": f"{category}/{filename}",
                "is_active": is_active, "type": s_type,
            })
            continue

        print(f"  {status} [{i}/{len(scenarios)}] {name}...", end=" ", flush=True)

        try:
            blueprint_data = api_get(f"/scenarios/{sid}/blueprint")
            blueprint = blueprint_data.get("response", {}).get("blueprint", blueprint_data)
            category_dir.mkdir(parents=True, exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(blueprint, f, indent=2, ensure_ascii=False)
            print("OK")
            manifest["scenarios"].append({
                "id": sid, "name": name, "category": category,
                "filename": f"{category}/{filename}",
                "is_active": is_active, "type": s_type,
            })
        except Exception as e:
            print(f"ERROR: {e}")
            errors.append({"id": sid, "name": name, "error": str(e)})

        # Rate limiting delay
        time.sleep(API_DELAY)

    with open(output_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"Exportados: {len(manifest['scenarios'])} escenarios")
    if skipped:
        print(f"Salteados (ya existian): {skipped}")
    if errors:
        print(f"Errores: {len(errors)}")
        for err in errors:
            print(f"  - [{err['id']}] {err['name']}: {err['error']}")
    print(f"Carpeta: {output_dir}/")
    print(f"Manifest: {output_dir}/manifest.json")
    if errors:
        print(f"\nTIP: Volve a ejecutar el mismo comando para reintentar los que fallaron.")
    print(f"\nPara versionar: git add {output_dir} && git commit -m 'Snapshot {datetime.date.today()}'")

def cmd_import(args):
    check_config()
    folder = Path(args.folder)
    if not folder.exists():
        print(f"Carpeta {folder} no existe")
        return

    json_files = sorted([
        f for f in folder.rglob("*.json")
        if f.name not in ("manifest.json", "CHANGELOG.json")
    ])
    if not json_files:
        print(f"No hay archivos JSON en {folder}")
        return

    to_import = []
    for json_file in json_files:
        stem = json_file.stem
        parts = stem.split("_", 1)
        try:
            scenario_id = int(parts[0])
            to_import.append({"id": scenario_id, "path": json_file, "name": parts[1] if len(parts) > 1 else ""})
        except ValueError:
            print(f"  WARN: No puedo extraer ID de {json_file.name}, saltando...")

    if not to_import:
        print("No se encontraron archivos con formato valido ({id}_{nombre}.json)")
        return

    print(f"Importar {len(to_import)} escenarios desde {folder}/")
    print("=" * 60)
    for item in to_import:
        print(f"  [{item['id']}] {item['path'].name}")

    if not args.yes:
        confirm = input(f"\nConfirmar importacion a PRODUCCION? (escribi 'si'): ").strip().lower()
        if confirm not in ("si", "yes", "s"):
            print("Cancelado.")
            return

    success = 0
    errors = []
    for item in to_import:
        sid = item["id"]
        fpath = item["path"]
        print(f"\n  UPLOAD [{sid}] {fpath.name}...", end=" ", flush=True)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                blueprint = json.load(f)
            blueprint_str = json.dumps(blueprint)
            api_patch(f"/scenarios/{sid}", {"blueprint": blueprint_str})
            print("OK")
            success += 1
        except Exception as e:
            print(f"ERROR: {e}")
            errors.append({"id": sid, "path": str(fpath), "error": str(e)})
        time.sleep(API_DELAY)

    print(f"\n{'=' * 60}")
    print(f"Importados: {success}/{len(to_import)}")
    if errors:
        print(f"Errores: {len(errors)}")
        for err in errors:
            print(f"  - [{err['id']}]: {err['error']}")

def cmd_diff(args):
    folder_a = Path(args.folder_a)
    folder_b = Path(args.folder_b)
    if not folder_a.exists() or not folder_b.exists():
        print("Una o ambas carpetas no existen")
        return

    files_a = {f.name: f for f in folder_a.rglob("*.json") if f.name != "manifest.json"}
    files_b = {f.name: f for f in folder_b.rglob("*.json") if f.name != "manifest.json"}
    all_files = sorted(set(files_a.keys()) | set(files_b.keys()))

    print(f"Comparando: {folder_a} <-> {folder_b}")
    print("=" * 60)

    changes = 0
    for fname in all_files:
        if fname in files_a and fname not in files_b:
            print(f"  DELETED: {fname}")
            changes += 1
        elif fname not in files_a and fname in files_b:
            print(f"  NEW:     {fname}")
            changes += 1
        else:
            try:
                with open(files_a[fname]) as fa, open(files_b[fname]) as fb:
                    content_a = json.dumps(json.load(fa), indent=2, sort_keys=True)
                    content_b = json.dumps(json.load(fb), indent=2, sort_keys=True)
                if content_a != content_b:
                    print(f"  CHANGED: {fname}")
                    changes += 1
                    if args.verbose:
                        diff = difflib.unified_diff(
                            content_a.splitlines(), content_b.splitlines(),
                            fromfile=f"a/{fname}", tofile=f"b/{fname}", lineterm="")
                        for line in list(diff)[:50]:
                            print(f"    {line}")
            except Exception as e:
                print(f"  WARN: Error comparando {fname}: {e}")

    if changes == 0:
        print("\n  Sin diferencias")
    else:
        print(f"\n  {changes} archivo(s) con diferencias")

def cmd_prepare_fix(args):
    source = Path(args.source)
    if not source.exists():
        print(f"Carpeta source {source} no existe")
        return

    fix_name = args.name or f"{datetime.date.today().isoformat()}_fix"
    fix_dir = Path(f"fixes/{fix_name}")
    if fix_dir.exists():
        print(f"Carpeta {fix_dir} ya existe")
        return

    scenario_ids = [int(sid.strip()) for sid in args.ids.split(",")]
    found = []
    for json_file in source.rglob("*.json"):
        if json_file.name == "manifest.json":
            continue
        try:
            file_id = int(json_file.stem.split("_")[0])
            if file_id in scenario_ids:
                found.append(json_file)
        except ValueError:
            continue

    if not found:
        print(f"No se encontraron escenarios con IDs: {scenario_ids}")
        return

    fix_dir.mkdir(parents=True, exist_ok=True)
    print(f"Creando carpeta de fix: {fix_dir}/")
    for f in found:
        relative = f.relative_to(source)
        dest = fix_dir / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(f, dest)
        print(f"  {relative}")

    changelog = fix_dir / "CHANGELOG.md"
    lines = [f"# {fix_name}\n", f"\n## Fecha: {datetime.date.today().isoformat()}\n",
             "\n## Escenarios modificados\n", "\n| ID | Nombre | Cambio realizado |",
             "\n|----|--------|-----------------|"]
    for f in found:
        parts = f.stem.split("_")
        lines.append(f"\n| {parts[0]} | {'_'.join(parts[1:])} | TODO: describir cambio |")
    lines.append("\n\n## Descripcion del cambio\n\nTODO: describir que se corrigio y por que.\n")
    changelog.write_text("".join(lines))

    print(f"\nCarpeta de fix creada: {fix_dir}/")
    print(f"  Edita los JSON y completa {fix_dir}/CHANGELOG.md")
    print(f"  Cuando estes listo: python make_sync.py import {fix_dir}")

def main():
    parser = argparse.ArgumentParser(
        description="IITA Make.com Scenario Sync Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python make_sync.py setup
  python make_sync.py list
  python make_sync.py export
  python make_sync.py export -o snapshots/pre_fix
  python make_sync.py prepare-fix -s snapshots/2026-02-18_produccion -i 123,456 -n fix_bugs_p0
  python make_sync.py import fixes/fix_bugs_p0
  python make_sync.py diff snapshots/antes snapshots/despues -v
        """)
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("setup", help="Configuracion inicial (detecta region y team)")
    subparsers.add_parser("list", help="Listar todos los escenarios de Make.com")

    export_p = subparsers.add_parser("export", help="Exportar todos los blueprints")
    export_p.add_argument("-o", "--output", help="Carpeta de salida")

    import_p = subparsers.add_parser("import", help="Importar blueprints modificados a Make.com")
    import_p.add_argument("folder", help="Carpeta con los JSONs corregidos")
    import_p.add_argument("-y", "--yes", action="store_true", help="No pedir confirmacion")

    diff_p = subparsers.add_parser("diff", help="Comparar dos carpetas de blueprints")
    diff_p.add_argument("folder_a", help="Carpeta original")
    diff_p.add_argument("folder_b", help="Carpeta modificada")
    diff_p.add_argument("-v", "--verbose", action="store_true", help="Mostrar diff detallado")

    prep_p = subparsers.add_parser("prepare-fix", help="Preparar carpeta de fix con escenarios especificos")
    prep_p.add_argument("-s", "--source", required=True, help="Carpeta snapshot de origen")
    prep_p.add_argument("-i", "--ids", required=True, help="IDs de escenarios (separados por coma)")
    prep_p.add_argument("-n", "--name", help="Nombre de la carpeta de fix")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    commands = {
        "setup": cmd_setup, "list": cmd_list, "export": cmd_export,
        "import": cmd_import, "diff": cmd_diff, "prepare-fix": cmd_prepare_fix,
    }
    commands[args.command](args)

if __name__ == "__main__":
    main()
