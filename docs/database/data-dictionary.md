# Diccionario de datos — IITA CRM

Ultima actualizacion: 2026-02-20 | Autor: gviollaz + Claude Opus 4.6

## Resumen

31 tablas en schema public. Principales:
- interactions ~102K, person_soft_data ~75K, persons ~25K
- conversations ~24K, person_conversation ~24K, system_conversation ~24K
- person_contacts ~21K, ai_interaction ~12K

## 1. Nucleo de mensajeria

### persons (~25K)
Personas/leads del sistema.
Campos: id (PK), first_name, last_name, email, birth_date, country, state_province, location_address, national_id, legal_guardian_id (FK self-ref), creation_datetime

### conversations (~24K)
Hilo de conversacion (uno por address+channel).
Campos: id (PK), start_date (default now()), last_activity_at (timestamptz)

### person_conversation (~24K)
Lado persona. Campos: id, id_person (FK persons), id_conversation (FK conversations), address, contact_username

### system_conversation (~24K)
Lado sistema. Campos: id, id_channel (FK channels), id_conversation (FK conversations)

### interactions (~102K) - TABLA CENTRAL
Constraint chk_single_direction: solo entrante OR saliente.
Campos: id, external_ref, id_person_conversation (FK entrante), id_system_conversation (FK saliente), text, time_stamp, ad_id (FK ads), status (enum default new)
Estados: new -> preprocessed -> processed -> pending_delivery -> sending -> send

### ai_interaction (~12K)
Respuestas IA. Campos: id, associated_interaction_id (FK), generated_interaction_id (FK), response, system_prompt, evaluation (pending/approved/confictive)

### interaction_medias
Puente. Campos: id, interaction_id (FK), media_id (FK)

### medias (~53)
Multimedia. Campos: id, name, content_dir, type, description, disabled

## 2. Canales y sedes
- channel_providers (~5): id, name
- channels (~11): id, id_channel_provider (FK), name, address, branch_id (FK), descrption (typo historico)
- branches (~2): id, name, google_maps, location_address

## 3. Datos de personas
- person_contacts (~21K): id, person_id (FK), channel_provider_id (FK), contact_value, external_reference
- person_soft_data (~75K): id, person_id (FK), data_name, data_content, datetime, disabled, editable
- person_enrichment_log: id, person_id (FK UNIQUE), analyzed_at, model_used, script_version, confidence, incoming_msgs, transcript_chars, tags_found[], fields_inserted[], fields_skipped[], raw_extraction (jsonb), status, error_detail

## 4. Publicidad
- ad_providers: id, name
- ads (~17): id, ad_provider_id (FK), course_id (FK), title, external_ref

## 5. Cursos
- courses (~40): id, name, bill_type, registration_price, quota_price, duration, description, playlist_name, disable
- course_editions (~98): id, course_id (FK), status (Enrolling->Pending->In_Progress->Conclude->Disabled), student_capacity, tentative_start/end_date, min/max_age, detail, modality, branch_id
- course_edition_schedule: id, course_edition_id (FK), class_day, start_time, end_time, disabled_date
- course_members: id, course_edition_id (FK), person_id (FK), status, role (default student)
- course_tickets: id, payment_ticket_id (FK), course_member_id (FK), month_quota, registration

## 6-8. Pagos, Sesiones, RBAC (tablas vacias)

## Tipos ENUM
- ai_interaction_evaluation: pending, approved, confictive
- interaction_status: new, preprocessed, processed, pending_delivery, sending, send
- course_edition_status: Enrolling, Pending, In_Progress, Conclude, Disabled
- courses_modality: online, presencial, hibrido
- course_participant_role: student, teacher, tutor
- courses_bill_type: ONLY_REGISTRATION, MONTHLY
- logs_authors: system, admin
- recording_status: pending, completed
- week_day: Monday a Sunday
