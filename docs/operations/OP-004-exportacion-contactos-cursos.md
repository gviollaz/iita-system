# OP-004 | Corrección de Tags Online/Presencial y Exportación de Contactos VCF

- **Fecha:** 2026-02-21
- **Autor:** Gustavo + Claude
- **Estado:** Completada

---

## Contexto

Se detectó que el sistema de análisis IA (gpt-4o-mini via Edge Function `ai-analysis-edge-v1`) estaba asignando por defecto la modalidad "Online" a contactos que no especificaban preferencia, incluyendo personas con teléfono de Salta (387) que con alta probabilidad están interesadas en modalidad presencial.

Esto provocaba una distorsión severa en los tags de `person_soft_data.tag_curso_interes`. Por ejemplo, Marketing Digital tenía 1,203 registros "Online" vs solo 75 "Presencial", cuando el 60% de los contactos tienen teléfono de Salta.

## Diagnóstico

El análisis IA registraba en `_ia_analysis_meta` que insertaba `tag_curso_interes` y `pref_modalidad`, pero en la mayoría de casos la persona no mencionaba modalidad explícitamente. La IA defaulteaba a "Online".

Distribución de `pref_modalidad` en Marketing Digital antes de la corrección:

| tag_curso_interes | pref_modalidad | personas |
|---|---|---|
| Marketing Digital Online | null (sin datos) | 1,104 |
| Marketing Digital Online | online | 49 |
| Marketing Digital Online | presencial | 34 |
| Marketing Digital Presencial | presencial | 53 |
| Marketing Digital Presencial | null | 11 |

El 92% de los tagueados como "Online" no tenían preferencia explícita.

## Regla de corrección aplicada

**Prioridad 1:** Si la persona declaró explícitamente su `pref_modalidad` (online o presencial), se respeta.

**Prioridad 2:** Si no hay `pref_modalidad` explícita:
- Teléfono con prefijo `549387` (Salta Capital) → **Presencial**
- Teléfono con otro prefijo → **Online**

**Nota:** Los que tenían `pref_modalidad = 'ambos'` se trataron igual que los sin preferencia (se aplicó regla por teléfono).

## Cursos afectados

### Marketing Digital

```sql
-- Online→Presencial: Salta sin pref explícita
UPDATE person_soft_data psd
SET data_content = 'Marketing Digital Presencial'
FROM person_contacts pc
WHERE pc.person_id = psd.person_id 
  AND pc.channel_provider_id IN (1,4) 
  AND pc.contact_value LIKE '549387%'
  AND psd.data_name = 'tag_curso_interes' 
  AND psd.data_content = 'Marketing Digital Online' 
  AND psd.disabled IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1 FROM person_soft_data pmod 
    WHERE pmod.person_id = psd.person_id 
      AND pmod.data_name = 'pref_modalidad' 
      AND pmod.disabled IS NOT TRUE 
      AND pmod.data_content IN ('online','presencial')
  );

-- Online→Presencial: pref explícita = presencial
UPDATE person_soft_data psd
SET data_content = 'Marketing Digital Presencial'
FROM person_soft_data pmod
WHERE pmod.person_id = psd.person_id 
  AND pmod.data_name = 'pref_modalidad' AND pmod.disabled IS NOT TRUE 
  AND pmod.data_content = 'presencial'
  AND psd.data_name = 'tag_curso_interes' 
  AND psd.data_content = 'Marketing Digital Online' AND psd.disabled IS NOT TRUE;

-- Presencial→Online: no Salta sin pref
UPDATE person_soft_data psd
SET data_content = 'Marketing Digital Online'
FROM person_contacts pc
WHERE pc.person_id = psd.person_id 
  AND pc.channel_provider_id IN (1,4) 
  AND pc.contact_value NOT LIKE '549387%'
  AND psd.data_name = 'tag_curso_interes' 
  AND psd.data_content = 'Marketing Digital Presencial' AND psd.disabled IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1 FROM person_soft_data pmod 
    WHERE pmod.person_id = psd.person_id 
      AND pmod.data_name = 'pref_modalidad' AND pmod.disabled IS NOT TRUE 
      AND pmod.data_content IN ('online','presencial')
  );
```

### Videojuegos

Mismo patrón que Marketing Digital, aplicado a `Videojuegos Online` ↔ `Videojuegos Presencial`.

### Robótica con Arduino

Mismo patrón:
- `Robótica con Arduino` (genérico, no Salta) → `Robótica con Arduino Online`
- `Robótica con Arduino Online` (Salta) → `Robótica con Arduino`

### Deduplicación Arduino

Tras los updates, 1,011 personas tenían registros duplicados (antes tenían "Arduino" + "Arduino Online" y ambos convergieron al mismo valor). Se desactivaron los duplicados:

```sql
UPDATE person_soft_data
SET disabled = TRUE
WHERE id IN (
  SELECT psd.id
  FROM person_soft_data psd
  INNER JOIN (
    SELECT person_id, data_content, MIN(id) as keep_id
    FROM person_soft_data
    WHERE data_name = 'tag_curso_interes' AND disabled IS NOT TRUE
      AND data_content IN ('Robótica con Arduino', 'Robótica con Arduino Online')
    GROUP BY person_id, data_content
    HAVING COUNT(*) > 1
  ) dups ON dups.person_id = psd.person_id 
    AND dups.data_content = psd.data_content AND psd.id != dups.keep_id
  WHERE psd.data_name = 'tag_curso_interes' AND psd.disabled IS NOT TRUE
    AND psd.data_content IN ('Robótica con Arduino', 'Robótica con Arduino Online')
);
```

## Resultado de la corrección

| Etiqueta | Antes | Después |
|---|---|---|
| Marketing Digital Online | 1,203 | 525 |
| Marketing Digital Presencial | 75 | 753 |
| Robótica con Arduino (presencial) | 1,805 | 844 |
| Robótica con Arduino Online | 1,010 | 1,077 |
| Videojuegos Online | 915 | 1,070 |
| Videojuegos Presencial | 476 | 562 |

## Exportación VCF

Post-corrección se generó un archivo VCF 3.0 con **7,695 contactos únicos** para importar en Google Contacts / teléfono.

### Prefijos utilizados

| Prefijo | Curso | Contactos |
|---|---|---|
| RBE | Robótica Educativa | 3,464 |
| RAO | Robótica con Arduino Online | 1,058 |
| VJO | Videojuegos Online | 891 |
| RAP | Robótica con Arduino Presencial | 675 |
| MKP | Marketing Digital Presencial | 651 |
| VJP | Videojuegos Presencial | 414 |
| MKO | Marketing Digital Online | 386 |
| Combinaciones | Ej: RAP-RBE, MKP-RBE | 156 |

### Formato del nombre en VCF

- Con nombre: `{PREFIJOS} {Nombre} {Apellido}` → ej: `RBE María López`
- Múltiples intereses: `{PREF1}-{PREF2} {Nombre}` → ej: `MKO-RBE Simona Alicia`
- Sin nombre: `{PREFIJOS} {teléfono}` → ej: `VJO 5493876378982`

## Rollback

No hay un rollback directo ya que los tags originales fueron sobrescritos. Sin embargo, los valores originales se pueden reconstruir a partir de `_ia_analysis_meta` (que no fue modificado) volviendo a ejecutar el tagging original de la IA.

## Verificación

```sql
-- Verificar distribución post-corrección
SELECT data_content, COUNT(*) as registros, COUNT(DISTINCT person_id) as personas
FROM person_soft_data
WHERE data_name = 'tag_curso_interes' AND disabled IS NOT TRUE
GROUP BY data_content
ORDER BY data_content;
```

## Antecedente: Exportación de Cursos de Python (2026-02-14/15)

Antes de esta operación, se realizó una exportación similar para contactos interesados en Python, en formato CSV para Google Contacts. Los prefijos utilizados fueron:

| Prefijo | Curso |
|---|---|
| PYP | Python Presencial |
| PYO | Python Online |
| PYA | Python Avanzado |
| PYG | Python Genérico |
| PYIA | IA con Python |

Esa exportación se hizo sobre la base de datos anterior (`kdwdknuhowdehknztark`) con un esquema diferente (`core_tags`, `core_person_tags`). La presente operación usa el esquema actual (`person_soft_data.tag_curso_interes`).
