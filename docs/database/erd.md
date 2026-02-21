# IITA CRM — Diagrama Entidad-Relacion

> **Generado desde:** PostgreSQL 17, Supabase `cpkzzzwncpbzexpesock`
> **Ultima actualizacion:** 2026-02-20
> **Formato:** Mermaid (renderiza en GitHub, VS Code, Notion)

## Nucleo: Mensajeria

```mermaid
erDiagram
    persons {
        int id PK
        text first_name
        text last_name
        varchar email
        date birth_date
        varchar national_id
        varchar country
        varchar state_province
        int legal_guardian_id FK
    }

    conversations {
        int id PK
        timestamp start_date
        timestamptz last_activity_at
    }

    person_conversation {
        int id PK
        int id_person FK
        int id_conversation FK
        text address
        text contact_username
    }

    system_conversation {
        int id PK
        int id_channel FK
        int id_conversation FK
    }

    interactions {
        int id PK
        int id_person_conversation FK
        int id_system_conversation FK
        text text
        timestamp time_stamp
        enum status
        text external_ref
        int ad_id FK
    }

    ai_interaction {
        int id PK
        int associated_interaction_id FK
        int generated_interaction_id FK
        text response
        text system_prompt
        enum evaluation
    }

    channels {
        int id PK
        int id_channel_provider FK
        text name
        text address
        int branch_id FK
    }

    channel_providers {
        int id PK
        text name
    }

    branches {
        int id PK
        text name
        text location_address
    }

    medias {
        int id PK
        varchar name
        text content_dir
        text type
        text description
    }

    interaction_medias {
        int id PK
        int interaction_id FK
        int media_id FK
    }

    persons ||--o{ person_conversation : "participa en"
    persons ||--o{ person_contacts : "tiene contactos"
    persons ||--o{ person_soft_data : "datos enriquecidos"
    persons |o--o| persons : "legal_guardian_id"

    conversations ||--|| person_conversation : "lado persona"
    conversations ||--|| system_conversation : "lado canal"

    person_conversation ||--o{ interactions : "mensajes entrantes"
    system_conversation ||--o{ interactions : "mensajes salientes"

    interactions ||--o| ai_interaction : "respuesta IA"
    interactions ||--o{ interaction_medias : "tiene adjuntos"
    interaction_medias }o--|| medias : "archivo"

    channels ||--o{ system_conversation : "recibe conversaciones"
    channel_providers ||--o{ channels : "provee canales"
    branches ||--o{ channels : "sede del canal"

    interactions }o--o| ads : "originado por publicidad"
```

## Cursos e inscripciones

```mermaid
erDiagram
    courses {
        int id PK
        varchar name
        enum bill_type
        float registration_price
        float quota_price
        text duration
    }

    course_editions {
        int id PK
        int course_id FK
        enum status
        int student_capacity
        date tentative_start_date
        int branch_id FK
    }

    course_edition_schedule {
        int id PK
        int course_edition_id FK
        enum class_day
        time start_time
        time end_time
    }

    course_members {
        int id PK
        int course_edition_id FK
        int person_id FK
        enum status
        enum role
    }

    ads {
        int id PK
        int ad_provider_id FK
        int course_id FK
        text title
        text external_ref
    }

    ad_providers {
        int id PK
        text name
    }

    courses ||--o{ course_editions : "tiene ediciones"
    courses ||--o{ ads : "publicidad"
    course_editions ||--o{ course_edition_schedule : "horarios"
    course_editions ||--o{ course_members : "inscriptos"
    course_members }o--|| persons : "persona inscripta"
    branches ||--o{ course_editions : "sede"
    ad_providers ||--o{ ads : "plataforma"
```

## Contactos y datos enriquecidos

```mermaid
erDiagram
    person_contacts {
        int id PK
        int person_id FK
        int channel_provider_id FK
        text contact_value
        text external_reference
    }

    person_soft_data {
        int id PK
        int person_id FK
        varchar data_name
        text data_content
        timestamp datetime
    }

    person_enrichment_log {
        int id PK
        int person_id FK
        timestamp analyzed_at
        text model_used
        text status
        jsonb raw_extraction
    }

    persons ||--o{ person_contacts : "contactos"
    persons ||--o{ person_soft_data : "datos key-value"
    persons ||--o| person_enrichment_log : "log enriquecimiento"
    channel_providers ||--o{ person_contacts : "por proveedor"
```

## RBAC (no implementado)

```mermaid
erDiagram
    users {
        int id PK
        varchar email
        text password
        int role_id FK
    }

    roles {
        int id PK
        varchar name
    }

    permissions {
        int id PK
        varchar code
        text description
    }

    role_permissions {
        int id PK
        int role_id FK
        int permission_id FK
    }

    branche_users {
        int id PK
        int branch_id FK
        int user_id FK
    }

    users }o--|| roles : "tiene rol"
    roles ||--o{ role_permissions : "tiene permisos"
    role_permissions }o--|| permissions : "permiso"
    users ||--o{ branche_users : "asignado a sede"
    branches ||--o{ branche_users : "usuarios de sede"
```
