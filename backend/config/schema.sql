-- Carri Health EMR Database Schema
-- Run this file once to initialise the database

CREATE DATABASE IF NOT EXISTS carri_health_emr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carri_health_emr;

-- ─────────────────────────────────────────────
-- hospitals
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  hospital_code VARCHAR(20)  UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  phone         VARCHAR(20),
  email         VARCHAR(255),
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- roles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50)  UNIQUE NOT NULL,
  label      VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO roles (name, label) VALUES
  ('doctor',      'Doctor'),
  ('nurse',       'Nurse'),
  ('lab',         'Lab Technician'),
  ('admin',       'Administrator'),
  ('super_admin', 'Super Administrator');

-- ─────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id   INT          NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT          NOT NULL,
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  created_by    INT,
  UNIQUE KEY unique_email_per_hospital (email, hospital_id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (role_id)     REFERENCES roles(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- patients
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id             INT          NOT NULL,
  carri_health_id         VARCHAR(20)  UNIQUE NOT NULL,
  full_name               VARCHAR(255) NOT NULL,
  date_of_birth           DATE         NOT NULL,
  sex                     ENUM('male','female','other') NOT NULL,
  blood_group             ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown') NOT NULL,
  phone                   VARCHAR(20),
  address                 TEXT,
  state_of_origin         VARCHAR(100),
  next_of_kin_name        VARCHAR(255),
  next_of_kin_contact     VARCHAR(20),
  known_allergies         TEXT,
  pre_existing_conditions TEXT,
  is_active               BOOLEAN      DEFAULT true,
  deactivated_at          TIMESTAMP    NULL,
  created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  created_by              INT          NOT NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- visits
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id         INT NOT NULL,
  patient_id          INT NOT NULL,
  visit_type          ENUM('outpatient','inpatient','emergency','follow_up') NOT NULL,
  visit_date          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attending_doctor_id INT,
  is_closed           BOOLEAN   DEFAULT false,
  created_by          INT       NOT NULL,
  FOREIGN KEY (hospital_id)         REFERENCES hospitals(id),
  FOREIGN KEY (patient_id)          REFERENCES patients(id),
  FOREIGN KEY (attending_doctor_id) REFERENCES users(id),
  FOREIGN KEY (created_by)          REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- clinical_notes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  visit_id    INT NOT NULL,
  patient_id  INT NOT NULL,
  subjective  TEXT,
  objective   TEXT,
  assessment  TEXT,
  plan        TEXT,
  clerking    TEXT,
  diagnosis   TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by  INT       NOT NULL,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (visit_id)    REFERENCES visits(id),
  FOREIGN KEY (patient_id)  REFERENCES patients(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- vitals
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id               INT           NOT NULL,
  visit_id                  INT           NOT NULL,
  patient_id                INT           NOT NULL,
  blood_pressure_systolic   INT,
  blood_pressure_diastolic  INT,
  temperature_celsius       DECIMAL(4,1),
  pulse_rate                INT,
  respiratory_rate          INT,
  spo2_percent              DECIMAL(4,1),
  weight_kg                 DECIMAL(5,1),
  height_cm                 DECIMAL(5,1),
  recorded_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  created_by                INT           NOT NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (visit_id)    REFERENCES visits(id),
  FOREIGN KEY (patient_id)  REFERENCES patients(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- prescriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id              INT          NOT NULL,
  visit_id                 INT          NOT NULL,
  patient_id               INT          NOT NULL,
  drug_name                VARCHAR(255) NOT NULL,
  dosage                   VARCHAR(100) NOT NULL,
  frequency                VARCHAR(100) NOT NULL,
  duration                 VARCHAR(100) NOT NULL,
  route_of_administration  VARCHAR(100) NOT NULL,
  prescribing_doctor_id    INT          NOT NULL,
  allergy_conflict_detected BOOLEAN     DEFAULT false,
  allergy_conflict_detail  TEXT,
  created_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id)           REFERENCES hospitals(id),
  FOREIGN KEY (visit_id)              REFERENCES visits(id),
  FOREIGN KEY (patient_id)            REFERENCES patients(id),
  FOREIGN KEY (prescribing_doctor_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- lab_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_requests (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id             INT          NOT NULL,
  visit_id                INT          NOT NULL,
  patient_id              INT          NOT NULL,
  test_name               VARCHAR(255) NOT NULL,
  requesting_clinician_id INT          NOT NULL,
  urgency                 ENUM('routine','urgent','stat') NOT NULL,
  status                  ENUM('pending','received','reviewed') DEFAULT 'pending',
  result_pdf_path         VARCHAR(500),
  result_text             TEXT,
  result_uploaded_at      TIMESTAMP    NULL,
  result_reviewed_by      INT,
  result_reviewed_at      TIMESTAMP    NULL,
  created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id)             REFERENCES hospitals(id),
  FOREIGN KEY (visit_id)                REFERENCES visits(id),
  FOREIGN KEY (patient_id)              REFERENCES patients(id),
  FOREIGN KEY (requesting_clinician_id) REFERENCES users(id),
  FOREIGN KEY (result_reviewed_by)      REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- nursing_notes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nursing_notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT          NOT NULL,
  visit_id    INT          NOT NULL,
  patient_id  INT          NOT NULL,
  note_text   TEXT         NOT NULL,
  shift_label ENUM('morning','afternoon','night') NOT NULL,
  nurse_id    INT          NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (visit_id)    REFERENCES visits(id),
  FOREIGN KEY (patient_id)  REFERENCES patients(id),
  FOREIGN KEY (nurse_id)    REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- medication_administration_records
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_administration_records (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id     INT          NOT NULL,
  prescription_id INT          NOT NULL,
  patient_id      INT          NOT NULL,
  administered_by INT          NOT NULL,
  administered_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  dose_given      VARCHAR(100),
  notes           TEXT,
  shift_label     ENUM('morning','afternoon','night') NOT NULL,
  FOREIGN KEY (hospital_id)     REFERENCES hospitals(id),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (patient_id)      REFERENCES patients(id),
  FOREIGN KEY (administered_by) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- audit_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT,
  user_id     INT,
  user_email  VARCHAR(255),
  user_role   VARCHAR(50),
  action_type ENUM(
    'login','logout',
    'record_create','record_edit','record_view','record_export',
    'user_created','user_deactivated'
  ) NOT NULL,
  record_type VARCHAR(100),
  record_id   INT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- Idempotent migrations (safe to re-run on every server start)
-- Uses PREPARE/EXECUTE so every step is conditional via information_schema —
-- works on MySQL 5.7 and 8.x (avoids ADD COLUMN IF NOT EXISTS which needs 8.0.3+).
-- ─────────────────────────────────────────────

-- M1: Add role_id to users if missing
SET @_c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role_id');
SET @_s := IF(@_c=0,'ALTER TABLE users ADD COLUMN role_id INT NULL','DO 0');
PREPARE _p FROM @_s; EXECUTE _p; DEALLOCATE PREPARE _p;

-- M2: Backfill role_id from old role ENUM column (only if that column still exists)
SET @_c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role');
SET @_s := IF(@_c>0,
  'UPDATE users u INNER JOIN roles r ON r.name=u.role SET u.role_id=r.id WHERE u.role_id IS NULL',
  'DO 0');
PREPARE _p FROM @_s; EXECUTE _p; DEALLOCATE PREPARE _p;

-- M3: Drop old role column once role_id is populated
SET @_c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role');
SET @_s := IF(@_c>0,'ALTER TABLE users DROP COLUMN role','DO 0');
PREPARE _p FROM @_s; EXECUTE _p; DEALLOCATE PREPARE _p;

-- M4a: patients.is_active
SET @_c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patients' AND COLUMN_NAME='is_active');
SET @_s := IF(@_c=0,'ALTER TABLE patients ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true','DO 0');
PREPARE _p FROM @_s; EXECUTE _p; DEALLOCATE PREPARE _p;

-- M4b: patients.deactivated_at
SET @_c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patients' AND COLUMN_NAME='deactivated_at');
SET @_s := IF(@_c=0,'ALTER TABLE patients ADD COLUMN deactivated_at TIMESTAMP NULL','DO 0');
PREPARE _p FROM @_s; EXECUTE _p; DEALLOCATE PREPARE _p;
