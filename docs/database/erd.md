# Diagrama Entidad-Relacion — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

## Diagrama 1: Nucleo de mensajeria

```mermaid
erDiagram
    persons ||--o{ person_conversation : tiene
    persons ||--o{ person_contacts : tiene
    persons ||--o{ person_soft_data : datos_blandos
    persons ||--o{ person_enrichment_log : analisis_IA
    conversations ||--o{ person_conversation : lado_persona
    conversations ||--o{ system_conversation : lado_sistema
    person_conversation ||--o{ interactions : entrantes
    system_conversation ||--o{ interactions : salientes
    channels ||--o{ system_conversation : usa
    channel_providers ||--o{ channels : provee
    branches ||--o{ channels : pertenece
    interactions ||--o{ ai_interaction : respuesta_IA
    interactions ||--o{ interaction_medias : adjunta
    medias ||--o{ interaction_medias : referenciada
    ads ||--o{ interactions : origen
```

Nota: interactions tiene constraint chk_single_direction.

## Diagrama 2: Cursos y pagos

```mermaid
erDiagram
    courses ||--o{ course_editions : ediciones
    courses ||--o{ ads : publicidad
    ad_providers ||--o{ ads : plataforma
    course_editions ||--o{ course_edition_schedule : horarios
    course_editions ||--o{ course_members : miembros
    course_editions ||--o{ virtual_sessions : sesiones
    branches ||--o{ course_editions : sede
    persons ||--o{ course_members : inscripto
    course_members ||--o{ course_tickets : tickets
    payment_tickets ||--o{ course_tickets : factura
    payment_tickets ||--o{ payments : pagos
    payments ||--o{ payments_logs : historial
    virtual_sessions ||--o{ session_recording : grabaciones
```

## Diagrama 3: RBAC (no implementado)

```mermaid
erDiagram
    roles ||--o{ users : asignado
    roles ||--o{ role_permissions : tiene
    permissions ||--o{ role_permissions : otorgada
    branches ||--o{ branche_users : sede
    users ||--o{ branche_users : trabaja
```

## 36 Foreign Keys

| Tabla origen | Campo FK | Tabla destino |
|---|---|---|
| ads | ad_provider_id | ad_providers |
| ads | course_id | courses |
| ai_interaction | associated_interaction_id | interactions |
| ai_interaction | generated_interaction_id | interactions |
| channels | branch_id | branches |
| channels | id_channel_provider | channel_providers |
| course_editions | course_id | courses |
| course_members | person_id | persons |
| interactions | id_person_conversation | person_conversation |
| interactions | id_system_conversation | system_conversation |
| person_contacts | person_id | persons |
| person_conversation | id_person | persons |
| person_conversation | id_conversation | conversations |
| person_enrichment_log | person_id | persons |
| person_soft_data | person_id | persons |
| persons | legal_guardian_id | persons |
| system_conversation | id_channel | channels |
| system_conversation | id_conversation | conversations |
| users | role_id | roles |
| virtual_sessions | id_course_edition | course_editions |
