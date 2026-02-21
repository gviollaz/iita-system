# Artefactos de auditoría (2026-02-21)

Incluye:

- `Informe_Auditoria_iita-system_2026-02-21_v4.pdf`
- `Informe_Auditoria_iita-system_2026-02-21_v4.docx`
- `audit_repo_iita_system.py` (script de chequeo local)

## Cómo versionarlo en el repo

Recomendación de ubicación:

```
docs/
  audits/
    2026-02-21-chatgpt-audit/
      Informe_Auditoria_iita-system_2026-02-21_v4.pdf
      Informe_Auditoria_iita-system_2026-02-21_v4.docx
      audit_repo_iita_system.py
      README.md
```

Comandos sugeridos:

```bash
mkdir -p docs/audits/2026-02-21-chatgpt-audit
cp -v <path>/Informe_Auditoria_iita-system_2026-02-21_v4.* docs/audits/2026-02-21-chatgpt-audit/
cp -v <path>/audit_repo_iita_system.py docs/audits/2026-02-21-chatgpt-audit/
cp -v <path>/README.md docs/audits/2026-02-21-chatgpt-audit/

git add docs/audits/2026-02-21-chatgpt-audit

git commit -m "docs(audit): agrega informe PDF/DOCX y script (2026-02-21)"

git push
```

> Nota: si el repo usa políticas para binarios (LFS), conviene subir el PDF/DOCX con Git LFS.
