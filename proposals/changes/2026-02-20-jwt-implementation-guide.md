# Propuesta Técnica: Implementación de JWT y Aseguramiento de API

- **Fecha:** 2026-02-20
- **Autor IA:** Gemini CLI 2.0
- **Prioridad:** P0
- **Estado:** pendiente
- **Relacionado con:** Propuesta #4, BUG-011, FEAT-010, FEAT-011

## Diagnóstico

Las Edge Functions actuales (`crm-api`, `courses-crud`) actúan como proxies administrativos sin autenticación. Esto permite que cualquier usuario con la URL pueda:
1.  Leer toda la tabla `persons` (25K registros).
2.  Eliminar registros de `interactions` o `conversations`.
3.  Modificar estados de cursos.

## Solución Propuesta: Autenticación Híbrida

Se propone un esquema que soporte tanto usuarios humanos (JWT) como procesos automáticos (API Key).

### 1. Variables de Entorno Necesarias

- `INTERNAL_API_KEY`: Un secreto compartido entre Make.com y Supabase.
- `APP_DOMAIN`: El dominio del CRM para validar CORS de forma estricta.

### 2. Implementación de Middleware de Seguridad

Se debe crear un archivo de utilidad `shared/auth.ts` (o similar) para ser importado por todas las funciones:

```typescript
// Esquema de validacion propuesto
export async function authenticate(req: Request, supabaseClient: any) {
  const authHeader = req.headers.get("Authorization");
  const internalKey = req.headers.get("X-Internal-Key");

  // A. Validacion para Procesos Automaticos (Make.com)
  if (internalKey && internalKey === Deno.env.get("INTERNAL_API_KEY")) {
    return { type: "system", role: "service_role" };
  }

  // B. Validacion para Usuarios (Frontend)
  if (!authHeader) throw new Error("Missing Authorization header");
  
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  
  if (error || !user) throw new Error("Invalid or expired token");

  return { type: "user", user, role: "authenticated" };
}
```

### 3. Refactorización de Endpoints Genéricos

Se debe eliminar el soporte para acciones CRUD arbitrarias sobre cualquier tabla.

```typescript
// ANTES (Inseguro)
const { action, table, data } = await req.json();
result = await supabase.from(table).insert(data);

// DESPUES (Seguro)
const ALLOWED_TABLES = ["interactions", "person_soft_data", "course_members"];
if (!ALLOWED_TABLES.includes(table)) {
  return new Response("Forbidden table", { status: 403 });
}
```

## Plan de Ejecución

1.  **Sincronización con Frontend**: Asegurar que el CRM esté listo para enviar el JWT (FEAT-010).
2.  **Actualización de Make.com**: Modificar los módulos HTTP en los 117 escenarios para que incluyan el header `X-Internal-Key`.
3.  **Despliegue de Edge Functions**: Subir las nuevas versiones con el middleware de autenticación.
4.  **Cierre de Grifo**: Cambiar `verify_jwt: true` en la configuración de Supabase para todas las funciones.

## Impacto en el Roadmap

Esta tarea es el prerrequisito para la **Fase 4 (RBAC)**. Sin un "Quién" (JWT), no podemos implementar un "Qué" (Permisos por Sede/Rol).

---

## Opinión del Experto (Gemini CLI 2.0)

Considero que la situación actual de las Edge Functions es de **alto riesgo de fuga de datos (Exfiltration)**. La implementación de esta propuesta no debe demorarse más allá de la próxima semana. Si no se puede implementar el Login completo inmediatamente, se recomienda al menos implementar la validación de `INTERNAL_API_KEY` y restringir el acceso por IP o dominio (CORS) de forma urgente.
