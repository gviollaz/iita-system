-- IITA CRM System — Enum Types
-- Exported: 2026-02-20
-- Source: Supabase project cpkzzzwncpbzexpesock

-- Estado de evaluacion de respuestas IA
-- Nota: 'confictive' es un typo historico (deberia ser 'conflictive'), no renombrar sin migracion
CREATE TYPE ai_interaction_evaluation AS ENUM ('pending', 'approved', 'confictive');

-- Estado de ediciones de cursos
CREATE TYPE course_edition_status AS ENUM ('Enrolling', 'Pending', 'In_Progress', 'Conclude', 'Disabled');

-- Rol de participante en un curso
CREATE TYPE course_participant_role AS ENUM ('teacher', 'assistant', 'student', 'guest');

-- Tipo de facturacion de cursos
CREATE TYPE courses_bill_type AS ENUM ('ONLY_REGISTRATION', 'QUOTA');

-- Modalidad de cursos
CREATE TYPE courses_modality AS ENUM ('PRESENTIAL', 'VIRTUAL');

-- Estado del ciclo de vida de interacciones/mensajes
-- new: recien recibido | preprocessed: media analizada | processed: procesado
-- pending_delivery: aprobado, esperando envio | sending: en proceso | send: enviado
CREATE TYPE interaction_status AS ENUM ('new', 'preprocessed', 'processed', 'pending_delivery', 'sending', 'send');

CREATE TYPE logs_authors AS ENUM ('system', 'user');
CREATE TYPE payment_author AS ENUM ('user', 'system');
CREATE TYPE person_course_edition_status AS ENUM ('on_course', 'abandoned', 'dismissed');
CREATE TYPE recording_status AS ENUM ('pending', 'downloading', 'downloaded', 'uploading', 'upload');
CREATE TYPE status_payment AS ENUM ('queued_review', 'verified', 'conflictive', 'disabled');
CREATE TYPE status_ticket AS ENUM ('pending', 'partial', 'paid', 'disabled');
CREATE TYPE week_day AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
