# Diagramas Entidad-Relación — Base de Datos Legacy

Última actualización: 2026-02-21 | Validado contra datos de producción

---

## 1. Dominio Principal: Personas, Conversaciones y Mensajes

```mermaid
erDiagram
    core_companies {
        bigint id PK
        varchar name
        varchar industry
    }
    
    core_branches {
        bigint id PK
        varchar name
        varchar location
        boolean client_support
    }
    
    core_chatproviders {
        bigint id PK
        varchar name
        varchar endpoint_url
    }
    
    core_companycomchannels {
        bigint id PK
        varchar address
        varchar group_address
        varchar name
        bigint branch_id FK
        bigint provider_id FK
    }
    
    core_persons {
        bigint id PK
        varchar first_name
        varchar last_name
        varchar region
        varchar phone_number
        varchar email
        varchar dni
        date birthday
        boolean ignore_feedback
    }
    
    core_personcomchannels {
        bigint id PK
        varchar address
        varchar group_address
        timestamptz time_out
        bigint person_id FK
        bigint chat_provider_id FK
    }
    
    core_conversations {
        bigint id PK
        timestamptz start
        timestamptz end
        text result
        bigint company_com_channel_id FK
        bigint person_com_channel_id FK
        bigint respondent_id FK
    }
    
    core_interactions {
        bigint id PK
        varchar provider_message_id
        text text
        timestamptz timestamp
        varchar sender
        integer status
        boolean postponed
        integer respond
        bigint conversation_id FK
        bigint person_id FK
        bigint media_id FK
        integer audit_user_id FK
    }
    
    core_media {
        bigint id PK
        varchar content
        varchar mimetype
        varchar name
    }

    core_companies ||--o{ core_companycomchannels : "tiene canales"
    core_branches ||--o{ core_companycomchannels : "sucursal"
    core_chatproviders ||--o{ core_companycomchannels : "proveedor"
    core_chatproviders ||--o{ core_personcomchannels : "proveedor"
    core_persons ||--o{ core_personcomchannels : "identidades"
    core_companycomchannels ||--o{ core_conversations : "canal empresa"
    core_personcomchannels ||--o{ core_conversations : "canal persona"
    core_conversations ||--o{ core_interactions : "mensajes"
    core_persons ||--o{ core_interactions : "persona (parcial)"
    core_media ||--o{ core_interactions : "adjunto"
```

---

## 2. Sistema de IA y Respondents

```mermaid
erDiagram
    core_aiproviders {
        bigint id PK
        varchar name
        varchar endpoint_url
        varchar encrypted_api_key
        integer max_resquests_per_day
        integer max_resquests_per_minute
        integer max_resquests_per_month
    }
    
    core_aimodels {
        bigint id PK
        varchar name
        bigint provider_id FK
    }
    
    core_aiparams {
        bigint id PK
        varchar name UK
        varchar type
    }
    
    core_values {
        bigint id PK
        float8 number_val
        text string_val
        float8 chance
        bigint param_id FK
        bigint model_val_id FK
    }
    
    core_respondentcache {
        bigint id PK
    }
    
    core_respondentcache_values {
        bigint id PK
        bigint respondentcache_id FK
        bigint values_id FK
    }
    
    core_aiinteractions {
        bigint id PK
        text text
        varchar media
        boolean acepted
        boolean failed
        timestamptz timestamp
        bigint conversation_id FK
        bigint final_interaction_id FK
        bigint log_entry_id FK
    }
    
    core_aiinteractionlog {
        bigint id PK
        text ai_text
        text final_text
        text prompt
        text request
        boolean edited_by_human
        integer rating
        text feedback
        varchar ai_model
        varchar ai_provider
    }
    
    core_airequestlog {
        bigint id PK
        timestamptz timestamp
        text response
        bigint provider_id FK
    }

    core_aiproviders ||--o{ core_aimodels : "modelos"
    core_aiproviders ||--o{ core_airequestlog : "requests"
    core_aiparams ||--o{ core_values : "valores posibles"
    core_aimodels ||--o{ core_values : "modelo referenciado"
    core_respondentcache ||--o{ core_respondentcache_values : "valores seleccionados"
    core_values ||--o{ core_respondentcache_values : "valor"
    core_conversations ||--o{ core_aiinteractions : "sugerencias IA"
    core_interactions ||--o| core_aiinteractions : "interacción final"
    core_aiinteractionlog ||--|| core_aiinteractions : "log detallado (1:1)"
    core_respondentcache ||--o{ core_conversations : "respondent asignado"
```

---

## 3. Etiquetas, Intereses y Cursos

```mermaid
erDiagram
    core_courses {
        bigint id PK
        varchar name
        varchar modality
        text additional_information
        varchar duration
        varchar bill_type
        integer quota_price
        integer registration_price
    }
    
    core_courseedition {
        bigint id PK
        varchar status
        varchar class_day
        time start_time
        time end_time
        integer min_age
        integer max_age
        date tentative_start_date
        bigint course_id FK
        bigint branch_id FK
    }

    core_interests {
        bigint id PK
        varchar name
        text description
    }
    
    core_personbyinterest {
        bigint id PK
        bigint interest_id FK
        bigint person_id FK
    }
    
    core_tags {
        bigint id PK
        varchar name
        varchar tag_type
        varchar modality
        text description
        boolean is_active
        bigint course_id FK
    }
    
    core_person_tags {
        bigint id PK
        varchar source
        float8 confidence
        bigint person_id FK
        bigint tag_id FK
    }
    
    core_person_profile {
        bigint person_id PK_FK
        varchar localidad
        varchar provincia
        varchar pais
        integer edad_consultada
        varchar consulta_para
        varchar preferencia_modalidad
        varchar source
    }
    
    core_lead_inquiry {
        bigint id PK
        varchar status
        varchar channel
        integer edad_alumno
        boolean es_para_si_mismo
        varchar modalidad_preferida
        bigint person_id FK
        bigint course_id FK
        bigint conversation_id FK
    }

    core_courses ||--o{ core_courseedition : "ediciones"
    core_branches ||--o{ core_courseedition : "sucursal"
    core_courses ||--o{ core_tags : "curso vinculado"
    core_interests ||--o{ core_personbyinterest : "interés"
    core_persons ||--o{ core_personbyinterest : "persona"
    core_tags ||--o{ core_person_tags : "tag"
    core_persons ||--o{ core_person_tags : "persona"
    core_persons ||--|| core_person_profile : "perfil 1:1"
    core_persons ||--o{ core_lead_inquiry : "consultas"
    core_courses ||--o{ core_lead_inquiry : "curso consultado"
```

---

## 4. Tablas Normalizadas vs. Originales

```mermaid
flowchart TD
    subgraph "Django Original"
        PI[core_personbyinterest<br/>8,873 registros]
        I[core_interests<br/>36 etiquetas desestructuradas]
        PCC[core_personcomchannels<br/>20,654 registros]
    end
    
    subgraph "Normalizado (post-migración)"
        PT[core_person_tags<br/>16,782 registros<br/>+ source + confidence]
        T[core_tags<br/>31 etiquetas tipificadas<br/>+ tag_type + course_id]
        PC[core_person_channels<br/>20,653 registros<br/>+ platform + display_name]
        PP[core_person_profile<br/>20,613 registros<br/>datos enriquecidos 1:1]
        LI[core_lead_inquiry<br/>0 registros<br/>tracking comercial]
    end
    
    PI -->|migrado a| PT
    I -->|reestructurado en| T
    PCC -->|normalizado en| PC
    
    style PI fill:#fff3e0
    style I fill:#fff3e0
    style PCC fill:#fff3e0
    style PT fill:#e8f5e9
    style T fill:#e8f5e9
    style PC fill:#e8f5e9
    style PP fill:#e8f5e9
    style LI fill:#fce4ec
```

---

## 5. Flujo de un Mensaje (nivel datos)

```mermaid
flowchart LR
    A[WhatsApp/Meta] -->|webhook| B[Servicio Flask]
    B -->|POST /api/messages| C[Core Django]
    
    C --> D{¿Persona existe?}
    D -->|No| E[CREATE core_persons<br/>+ core_personcomchannels]
    D -->|Sí| F[Buscar conversación abierta]
    E --> F
    
    F --> G{¿Conversación abierta?}
    G -->|No| H[CREATE core_conversations<br/>+ core_respondentcache]
    G -->|Sí| I[Usar existente]
    H --> J
    I --> J
    
    J[INSERT core_interactions<br/>sender=person, status=RECEIVED]
    J --> K[signal: recalculate]
    
    K --> L[Motor IA Thread]
    L --> M[OpenAI chat.completions]
    M --> N[INSERT core_aiinteractions<br/>+ core_aiinteractionlog]
    
    N --> O{¿Automonitor ON?}
    O -->|Sí| P[INSERT core_interactions<br/>sender=respondent, status=TO_SEND]
    O -->|No| Q[Esperar aprobación humana]
    Q --> P
    
    P --> R[POST a servicio Flask]
    R --> S[Meta API: enviar mensaje]
    S --> T[Webhook status: SENT/READ]
    T --> U[UPDATE core_interactions.status]
```
