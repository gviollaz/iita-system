#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audit rápido (estático) para repositorios tipo "iita-system".

Objetivo:
- Inventariar estructura y toolchain.
- Localizar documentación de referencia (normas/modelo de datos).
- Detectar señales de riesgo: TODO/FIXME, secretos potenciales, blueprints de Make, inconsistencias típicas.

Uso:
  python audit_repo_iita_system.py /ruta/al/repo
Salida:
  genera un reporte Markdown: ./reporte_auditoria_iita-system.md

Nota:
- Esto NO reemplaza una revisión manual. Es un "radar" para acelerar el trabajo.
"""

from __future__ import annotations
import os
import re
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

TEXT_FILE_EXTS = {
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".example",
    ".js", ".jsx", ".ts", ".tsx", ".py", ".sql", ".graphql", ".gql",
    ".html", ".css", ".scss", ".less", ".vue", ".svelte", ".java", ".kt", ".go",
    ".rb", ".php", ".sh"
}

SKIP_DIRS = {".git", "node_modules", ".next", "dist", "build", ".venv", "venv", "__pycache__", ".turbo", ".cache"}

SECRET_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Slack Token", re.compile(r"xox[baprs]-[0-9A-Za-z-]{10,}")),
    ("Private Key Block", re.compile(r"-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----")),
    ("JWT (heurístico)", re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}")),
    ("Generic api_key/token/secret assignment", re.compile(r"(?i)\b(api[_-]?key|token|secret|passwd|password)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]")),
]

TODO_PATTERN = re.compile(r"(?i)\b(TODO|FIXME|HACK)\b")

def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in TEXT_FILE_EXTS:
        return True
    # también permitimos archivos sin extensión pero típicos
    if path.name in {"Makefile", "Dockerfile"}:
        return True
    return False

def walk_repo(root: Path) -> List[Path]:
    files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # mutar dirnames para saltar directorios pesados
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            files.append(Path(dirpath) / fn)
    return files

def safe_read_text(path: Path, max_bytes: int = 400_000) -> Optional[str]:
    try:
        data = path.read_bytes()
        if len(data) > max_bytes:
            data = data[:max_bytes]
        # intento utf-8, si falla, latin-1
        try:
            return data.decode("utf-8", errors="replace")
        except Exception:
            return data.decode("latin-1", errors="replace")
    except Exception:
        return None

def detect_toolchain(root: Path) -> Dict[str, List[str]]:
    hits: Dict[str, List[str]] = {
        "frontend": [],
        "backend": [],
        "ci_cd": [],
        "infra": [],
        "data": [],
        "make": [],
        "docs": [],
    }

    # Front-end / Node
    for f in ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "vite.config.ts", "next.config.js", "nuxt.config.ts"]:
        if (root / f).exists():
            hits["frontend"].append(f)

    # Back-end (genérico)
    for f in ["requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile", "composer.json", "pom.xml", "build.gradle", "go.mod"]:
        if (root / f).exists():
            hits["backend"].append(f)

    # CI/CD
    if (root / ".github" / "workflows").exists():
        hits["ci_cd"].append(".github/workflows/*")
    if (root / ".gitlab-ci.yml").exists():
        hits["ci_cd"].append(".gitlab-ci.yml")

    # Infra
    for f in ["docker-compose.yml", "docker-compose.yaml", "Dockerfile", "terraform", "infra"]:
        if (root / f).exists():
            hits["infra"].append(f)

    # Data
    for f in ["prisma/schema.prisma", "supabase", "migrations", "db", "schema.sql"]:
        if (root / f).exists():
            hits["data"].append(f)

    # Make
    for f in ["make", "Make", "make/blueprints", "make/scenarios"]:
        if (root / f).exists():
            hits["make"].append(f)

    # Docs
    for f in ["README.md", "docs", "doc", "documentation"]:
        if (root / f).exists():
            hits["docs"].append(f)

    return hits

def summarize_tree(root: Path, files: List[Path]) -> Dict[str, int]:
    # Conteo por top-level folder
    counts: Dict[str, int] = {}
    for f in files:
        rel = f.relative_to(root)
        top = rel.parts[0] if len(rel.parts) > 1 else "."
        counts[top] = counts.get(top, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))

def extract_package_json_deps(root: Path) -> Dict[str, Dict[str, str]]:
    pj = root / "package.json"
    if not pj.exists():
        return {}
    try:
        obj = json.loads(pj.read_text(encoding="utf-8"))
    except Exception:
        return {"error": {"parse": "No se pudo parsear package.json"}}

    out: Dict[str, Dict[str, str]] = {}
    for k in ["dependencies", "devDependencies", "peerDependencies"]:
        if isinstance(obj.get(k), dict):
            out[k] = dict(sorted(obj[k].items()))
    return out

def find_docs_candidates(files: List[Path]) -> List[Path]:
    # Heurística: docs que suenan a "normas" o "modelo de datos"
    keywords = ["modelo", "datos", "norma", "uso", "arquitectura", "erd", "entidad", "schema", "make", "blueprint"]
    cand = []
    for f in files:
        name = f.name.lower()
        if f.suffix.lower() in {".md", ".txt"}:
            if any(k in name for k in keywords):
                cand.append(f)
    return cand[:50]

def scan_todos_and_secrets(root: Path, files: List[Path]) -> Tuple[List[Tuple[str,int,str]], List[Tuple[str,str]]]:
    todos: List[Tuple[str,int,str]] = []
    secrets: List[Tuple[str,str]] = []
    for f in files:
        if not is_text_file(f):
            continue
        text = safe_read_text(f)
        if text is None:
            continue

        # TODO/FIXME
        for i, line in enumerate(text.splitlines(), start=1):
            if TODO_PATTERN.search(line):
                rel = str(f.relative_to(root))
                snippet = line.strip()
                if len(snippet) > 200:
                    snippet = snippet[:200] + "…"
                todos.append((rel, i, snippet))
                if len(todos) >= 200:
                    break

        # Secret patterns (límites para no explotar)
        for label, pat in SECRET_PATTERNS:
            if pat.search(text):
                rel = str(f.relative_to(root))
                secrets.append((label, rel))
    # Deduplicar secretos
    secrets = sorted(list({(a,b) for a,b in secrets}))
    return todos, secrets

def find_make_blueprints(root: Path, files: List[Path]) -> List[Path]:
    blueprints = []
    for f in files:
        if f.suffix.lower() != ".json":
            continue
        name = f.name.lower()
        if "blueprint" in name or "scenario" in name or "make" in str(f.parent).lower():
            blueprints.append(f)
    return blueprints

def parse_make_blueprint(path: Path) -> Dict[str, object]:
    """
    Parseo heurístico: Make exporta JSON con estructuras que pueden variar.
    Intentamos:
    - detectar módulos
    - detectar webhooks / triggers
    - detectar "connections" o referencias sensibles
    """
    out: Dict[str, object] = {"file": str(path)}
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        out["error"] = f"No parseable JSON: {e}"
        return out

    # Buscar módulos en varios lugares comunes
    modules = []
    for key in ["modules", "flow", "subflows", "blueprint", "scenario"]:
        val = obj.get(key) if isinstance(obj, dict) else None
        # 'modules' típico
        if isinstance(val, list):
            for m in val:
                if isinstance(m, dict):
                    mod_type = m.get("module") or m.get("type") or m.get("name") or m.get("id")
                    if mod_type:
                        modules.append(str(mod_type))
        if isinstance(val, dict):
            # a veces blueprint.scenario.modules
            for k2 in ["modules", "flow"]:
                v2 = val.get(k2)
                if isinstance(v2, list):
                    for m in v2:
                        if isinstance(m, dict):
                            mod_type = m.get("module") or m.get("type") or m.get("name") or m.get("id")
                            if mod_type:
                                modules.append(str(mod_type))

    # Heurística de triggers/webhooks
    triggers = []
    def walk(o):
        if isinstance(o, dict):
            for k,v in o.items():
                if isinstance(k, str) and ("webhook" in k.lower() or "trigger" in k.lower()):
                    triggers.append(k)
                walk(v)
        elif isinstance(o, list):
            for it in o:
                walk(it)
    walk(obj)

    out["modules_detected"] = sorted(list(set(modules)))[:200]
    out["modules_count"] = len(set(modules))
    out["trigger_keys_detected"] = sorted(list(set(triggers)))[:100]

    # Buscar strings sospechosas de secretos dentro del JSON
    serialized = json.dumps(obj)
    secret_hits = []
    for label, pat in SECRET_PATTERNS:
        if pat.search(serialized):
            secret_hits.append(label)
    out["secret_patterns_in_blueprint"] = secret_hits

    return out

def write_report(root: Path) -> Path:
    files = walk_repo(root)
    toolchain = detect_toolchain(root)
    tree_counts = summarize_tree(root, files)
    deps = extract_package_json_deps(root)
    docs_candidates = find_docs_candidates(files)
    todos, secrets = scan_todos_and_secrets(root, files)
    blueprints = find_make_blueprints(root, files)

    # parse blueprints (limit)
    blueprint_summaries = []
    for bp in blueprints[:30]:
        blueprint_summaries.append(parse_make_blueprint(bp))

    out_path = root / "reporte_auditoria_iita-system.md"

    def md_list(items: List[str]) -> str:
        if not items:
            return "_(sin detectar)_"
        return "\n".join([f"- {i}" for i in items])

    lines: List[str] = []
    lines.append(f"# Reporte de auditoría (rápido) - iita-system")
    lines.append("")
    lines.append(f"- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"- Ruta analizada: `{root}`")
    lines.append(f"- Archivos totales (sin node_modules/dist/.git): **{len(files)}**")
    lines.append("")
    lines.append("## 1. Toolchain detectado (heurístico)")
    for k,v in toolchain.items():
        lines.append(f"### {k}")
        lines.append(md_list(v))
        lines.append("")

    lines.append("## 2. Estructura (conteo por carpeta top-level)")
    for folder,count in list(tree_counts.items())[:30]:
        lines.append(f"- `{folder}`: {count}")
    lines.append("")

    if deps:
        lines.append("## 3. Dependencias (package.json)")
        if "error" in deps:
            lines.append(f"- **Error**: {deps['error']}")
        else:
            for group, d in deps.items():
                lines.append(f"### {group}")
                for name, ver in list(d.items())[:200]:
                    lines.append(f"- `{name}`: `{ver}`")
        lines.append("")

    lines.append("## 4. Documentación candidata (normas / modelo / arquitectura)")
    if docs_candidates:
        for p in docs_candidates:
            rel = p.relative_to(root)
            lines.append(f"- `{rel}`")
    else:
        lines.append("_(no se detectaron candidatos obvios)_")
    lines.append("")

    lines.append("## 5. TODO/FIXME/HACK (hasta 200 ocurrencias)")
    if todos:
        for rel, ln, snippet in todos[:200]:
            lines.append(f"- `{rel}:{ln}` - {snippet}")
    else:
        lines.append("_(sin TODO/FIXME/HACK detectados)_")
    lines.append("")

    lines.append("## 6. Posibles secretos (heurístico, revisar manualmente)")
    if secrets:
        for label, rel in secrets:
            lines.append(f"- **{label}** en `{rel}`")
    else:
        lines.append("_(sin matches de patrones típicos)_")
    lines.append("")

    lines.append("## 7. Blueprints/escenarios Make (JSON) detectados")
    if blueprints:
        for bp in blueprints[:50]:
            lines.append(f"- `{bp.relative_to(root)}`")
    else:
        lines.append("_(no se detectaron JSONs que parezcan blueprints)_")
    lines.append("")

    if blueprint_summaries:
        lines.append("### 7.1 Resumen de blueprints (primeros 30)")
        for s in blueprint_summaries:
            rel = Path(s["file"]).relative_to(root) if s.get("file") else None
            lines.append(f"#### {rel}")
            if "error" in s:
                lines.append(f"- Error: {s['error']}")
                continue
            lines.append(f"- Módulos detectados (count): {s.get('modules_count')}")
            mods = s.get("modules_detected") or []
            if mods:
                lines.append("  - Ejemplos:")
                for m in mods[:25]:
                    lines.append(f"    - {m}")
            trig = s.get("trigger_keys_detected") or []
            if trig:
                lines.append("  - Keys tipo trigger/webhook:")
                for t in trig[:25]:
                    lines.append(f"    - {t}")
            sh = s.get("secret_patterns_in_blueprint") or []
            if sh:
                lines.append(f"- \u26a0\ufe0f Patrones de secreto dentro del JSON: {', '.join(sh)}")
        lines.append("")

    lines.append("## 8. Recomendaciones inmediatas (a completar con revisión manual)")
    lines.append("- Confirmar dónde vive la **documentación normativa**: `docs/` idealmente con `normas-uso.md` y `modelo-datos.md`.")
    lines.append("- Asegurar export de Make en `make/blueprints/` y documentar contratos I/O por escenario.")
    lines.append("- Si hay secretos detectados, rotarlos y agregarlos a un gestor de secretos. Añadir gitleaks en CI.")
    lines.append("- Correr lint/typecheck/tests y fijar baseline (pipeline).")
    lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path

def main():
    import sys
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(".").resolve()
    if not root.exists() or not root.is_dir():
        print(f"[ERROR] Ruta inválida: {root}")
        sys.exit(2)

    report = write_report(root)
    print(f"[OK] Reporte generado: {report}")

if __name__ == "__main__":
    main()
