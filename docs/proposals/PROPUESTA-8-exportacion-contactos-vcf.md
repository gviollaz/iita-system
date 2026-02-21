# Propuesta #8 — Exportación de Contactos VCF desde el CRM

- **Fecha:** 2026-02-21
- **Autor:** Gustavo + Claude
- **Estado:** Propuesta
- **Prioridad:** P1

---

## Problema

Actualmente la exportación de contactos para importar en teléfonos se hace de forma manual: se ejecutan queries SQL, se procesan los datos con scripts Python y se genera un archivo VCF o CSV. Este proceso:

1. **No es reproducible** sin conocimientos técnicos.
2. **No tiene interfaz** — requiere acceso directo a la base de datos.
3. **Los prefijos se definen ad-hoc** en cada exportación, sin un estándar definido.
4. **No permite selección visual** de qué contactos incluir.

Se han realizado al menos dos exportaciones manuales:
- **2026-02-14/15:** Contactos interesados en Python (CSV para Google Contacts), con prefijos PYP, PYO, PYA, PYG, PYIA.
- **2026-02-21:** Contactos de Robótica, Videojuegos y Marketing Digital (VCF), con prefijos RBE, RAP, RAO, VJO, VJP, MKO, MKP.

## Propuesta

Implementar un módulo de **Exportación de Contactos** en el CRM que permita generar archivos VCF importables desde Google Contacts / teléfono, con una interfaz visual para seleccionar los contactos y configurar los prefijos.

### Tabla de Prefijos Estándar

Definir una tabla de prefijos fijos en la base de datos para que todas las exportaciones usen la misma nomenclatura:

| Prefijo | Curso / Etiqueta | Modalidad |
|---|---|---|
| RBE | Robótica Educativa | Presencial |
| RAP | Robótica con Arduino | Presencial |
| RAO | Robótica con Arduino | Online |
| VJP | Videojuegos | Presencial |
| VJO | Videojuegos | Online |
| MKP | Marketing Digital | Presencial |
| MKO | Marketing Digital | Online |
| PYP | Python | Presencial |
| PYO | Python | Online |
| PYA | Python Avanzado | Online |
| PYG | Python (genérico) | Indeterminada |
| PYIA | IA con Python | Online |
| I3D | Impresión 3D | Presencial |
| BLO | Animación 3D Blender | Online |
| BLP | Animación 3D Blender | Presencial |
| F3D | Modelado 3D Fusion 360 | Presencial |
| DOM | Domótica | Presencial |
| PRG | Programación (genérico) | Indeterminada |

### Formato del Nombre en VCF

El formato del nombre del contacto sigue esta convención:

```
{PREFIJO(S)} {Nombre} {Apellido}
```

**Reglas:**
- Si la persona tiene una sola etiqueta: `RBE María López`
- Si tiene múltiples etiquetas, se concatenan ordenados alfabéticamente con guión: `MKO-RBE Simona Alicia`
- Si no tiene nombre registrado, se usa el teléfono: `VJO 5493876378982`

Este formato permite:
- Identificar rápidamente el interés del contacto al verlo en la agenda del teléfono.
- Filtrar contactos escribiendo el prefijo en el buscador del teléfono.
- Distinguir personas con intereses múltiples.

### Interfaz Propuesta

Agregar una sección "Exportar Contactos" en el CRM con los siguientes controles:

1. **Selector de etiquetas:** Checkboxes con las etiquetas disponibles de `tag_curso_interes`, mostrando la cantidad de contactos con teléfono para cada una.

2. **Filtro por ubicación:**
   - "Solo Salta (387)" — presenciales
   - "Solo interior/otras provincias" — online
   - "Todos"

3. **Filtro adicional:** Posibilidad de filtrar por provincia registrada, fecha de contacto, etc.

4. **Vista previa:** Tabla con los contactos que se van a exportar, mostrando nombre, teléfono, prefijo asignado. Permite deseleccionar contactos individuales.

5. **Botón de descarga:** Genera el archivo VCF y lo descarga.

### Formato de Archivo

**Formato principal: VCF 3.0** (vCard), compatible con:
- Google Contacts (importar desde contacts.google.com)
- iOS Contacts
- Android nativo
- Outlook

**Formato alternativo: CSV Google Contacts**, para quienes prefieran importar via spreadsheet.

Estructura VCF por contacto:
```
BEGIN:VCARD
VERSION:3.0
FN:{prefijos} {nombre completo}
N:{apellido};{prefijos} {nombre};;;
TEL;TYPE=CELL:+{telefono}
CATEGORIES:{etiquetas separadas por coma}
END:VCARD
```

## Implementación Técnica

### Opción A: Edge Function (recomendada)

Crear una Edge Function `export-contacts` que:

1. Reciba por POST los filtros (etiquetas, ubicación, formato).
2. Ejecute la query de contactos contra `persons` + `person_contacts` + `person_soft_data`.
3. Genere el archivo VCF/CSV en memoria.
4. Retorne el archivo con `Content-Disposition: attachment`.

```typescript
// Pseudocódigo de la Edge Function
Deno.serve(async (req) => {
  const { tags, location, format } = await req.json();
  
  // Query contacts
  const contacts = await supabase.rpc('get_exportable_contacts', {
    p_tags: tags,
    p_location_filter: location
  });
  
  // Apply prefix mapping
  const PREFIX_MAP = await supabase
    .from('export_prefix_config')
    .select('*');
  
  // Generate VCF
  const vcf = generateVCF(contacts, PREFIX_MAP);
  
  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': 'attachment; filename=contactos_iita.vcf'
    }
  });
});
```

### Opción B: Generación Client-Side

Hacer la query desde el frontend via Supabase client y generar el VCF en JavaScript en el navegador. Más simple pero limitado en volumen.

### Modelo de Datos: Tabla de Configuración de Prefijos

```sql
CREATE TABLE export_prefix_config (
  id SERIAL PRIMARY KEY,
  tag_value TEXT NOT NULL,          -- valor de tag_curso_interes
  prefix TEXT NOT NULL,             -- prefijo corto (RBE, RAP, etc.)
  display_name TEXT NOT NULL,       -- nombre legible ("Robótica Educativa")
  default_modality TEXT,            -- 'presencial', 'online', null
  sort_order INTEGER DEFAULT 0,     -- orden de aparición en UI
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(tag_value)
);

INSERT INTO export_prefix_config (tag_value, prefix, display_name, default_modality, sort_order) VALUES
('Robótica Educativa', 'RBE', 'Robótica Educativa', 'presencial', 1),
('Robótica con Arduino', 'RAP', 'Robótica Arduino Presencial', 'presencial', 2),
('Robótica con Arduino Online', 'RAO', 'Robótica Arduino Online', 'online', 3),
('Videojuegos Presencial', 'VJP', 'Videojuegos Presencial', 'presencial', 4),
('Videojuegos Online', 'VJO', 'Videojuegos Online', 'online', 5),
('Marketing Digital Presencial', 'MKP', 'Marketing Digital Presencial', 'presencial', 6),
('Marketing Digital Online', 'MKO', 'Marketing Digital Online', 'online', 7),
('Python Presencial', 'PYP', 'Python Presencial', 'presencial', 8),
('Python Online', 'PYO', 'Python Online', 'online', 9),
('Python Avanzado', 'PYA', 'Python Avanzado', 'online', 10),
('Python (genérico)', 'PYG', 'Python Genérico', NULL, 11),
('IA con Python', 'PYIA', 'IA con Python', 'online', 12),
('Impresión 3D', 'I3D', 'Impresión 3D', 'presencial', 13),
('Animación 3D Blender Online', 'BLO', 'Blender Online', 'online', 14),
('Animación 3D Blender Presencial', 'BLP', 'Blender Presencial', 'presencial', 15),
('Modelado 3D Fusion 360', 'F3D', 'Fusion 360', 'presencial', 16),
('Domótica', 'DOM', 'Domótica', 'presencial', 17),
('Programación (genérico)', 'PRG', 'Programación Genérico', NULL, 18);
```

### RPC para la query de exportación

```sql
CREATE OR REPLACE FUNCTION get_exportable_contacts(
  p_tags TEXT[],
  p_location_filter TEXT DEFAULT 'all'  -- 'salta', 'other', 'all'
)
RETURNS TABLE (
  person_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  telefono TEXT,
  etiquetas TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    pc.contact_value,
    array_agg(DISTINCT psd.data_content ORDER BY psd.data_content)
  FROM persons p
  JOIN person_contacts pc ON pc.person_id = p.id 
    AND pc.channel_provider_id IN (1, 4)
  JOIN person_soft_data psd ON psd.person_id = p.id 
    AND psd.data_name = 'tag_curso_interes' 
    AND psd.disabled IS NOT TRUE
    AND psd.data_content = ANY(p_tags)
  WHERE (
    p_location_filter = 'all'
    OR (p_location_filter = 'salta' AND pc.contact_value LIKE '549387%')
    OR (p_location_filter = 'other' AND pc.contact_value NOT LIKE '549387%')
  )
  GROUP BY p.id, p.first_name, p.last_name, pc.contact_value
  ORDER BY p.last_name, p.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Flujo de Usuario

1. El usuario abre "Exportar Contactos" desde el menú del CRM.
2. Ve la lista de etiquetas con checkboxes y cantidades.
3. Selecciona las etiquetas que quiere exportar (ej: RBE, RAP, VJP).
4. Opcionalmente filtra por ubicación.
5. Ve una vista previa con la cantidad total y algunos ejemplos.
6. Presiona "Descargar VCF" (o "Descargar CSV").
7. Importa el archivo en Google Contacts desde contacts.google.com.
8. Los contactos se sincronizan automáticamente al teléfono.

## Beneficios

- **Autonomía:** Cualquier miembro del equipo puede exportar contactos sin depender de soporte técnico.
- **Consistencia:** Los prefijos siempre son los mismos, evitando confusiones entre exportaciones.
- **Trazabilidad:** Se puede agregar un log de exportaciones para saber quién exportó qué y cuándo.
- **Escalabilidad:** Al agregar un nuevo curso, solo se agrega una fila a `export_prefix_config`.

## Consideraciones

- **Privacidad:** La exportación contiene datos personales (nombre + teléfono). Documentar quién tiene acceso y para qué fines.
- **Volumen:** Con ~7,700 contactos el VCF pesa ~1 MB, manejable. Si crece a 50K+ considerar exportación paginada.
- **Duplicados en teléfono:** Si se importa el mismo archivo dos veces, Google Contacts puede crear duplicados. Considerar agregar un UID único por contacto en el VCF para que las reimportaciones actualicen en vez de duplicar.

## Relación con otras propuestas

- **PROPUESTA-4 (JWT):** La Edge Function de exportación debería requerir autenticación para proteger los datos personales.
- **OP-004:** Esta propuesta formaliza el proceso manual documentado en OP-004.
