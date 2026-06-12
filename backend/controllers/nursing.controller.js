const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── createNursingNote ────────────────────────────────────────────────────────

async function createNursingNote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { visit_id, patient_id, note_text, shift_label } = req.body;
  const { hospitalId, userId } = req.user;

  const [visits] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visit_id, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }
  if (visits[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Cannot add nursing notes to a closed visit' });
  }

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patient_id, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [result] = await pool.query(
    `INSERT INTO nursing_notes
       (hospital_id, visit_id, patient_id, note_text, shift_label, nurse_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [hospitalId, visit_id, patient_id, note_text, shift_label, userId]
  );

  const noteId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'nursing_note', noteId, req);

  const [rows] = await pool.query(
    `SELECT nn.*, u.full_name AS nurse_name
     FROM nursing_notes nn
     JOIN users u ON u.id = nn.nurse_id
     WHERE nn.id = ? AND nn.hospital_id = ?`,
    [noteId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getNursingNotesByVisit ───────────────────────────────────────────────────

async function getNursingNotesByVisit(req, res) {
  const { hospitalId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [visits] = await pool.query(
    'SELECT id FROM visits WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  const [notes] = await pool.query(
    `SELECT nn.*, u.full_name AS nurse_name
     FROM nursing_notes nn
     JOIN users u ON u.id = nn.nurse_id
     WHERE nn.visit_id = ? AND nn.hospital_id = ?
     ORDER BY nn.created_at DESC`,
    [visitId, hospitalId]
  );

  return res.json({ success: true, data: notes });
}

// ─── getNursingNotesByPatient ─────────────────────────────────────────────────

async function getNursingNotesByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [notes] = await pool.query(
    `SELECT nn.*,
            u.full_name  AS nurse_name,
            v.visit_type,
            v.visit_date
     FROM nursing_notes nn
     JOIN users u   ON u.id  = nn.nurse_id
     JOIN visits v  ON v.id  = nn.visit_id
     WHERE nn.patient_id = ? AND nn.hospital_id = ?
     ORDER BY nn.created_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: notes });
}

// ─── recordMedicationAdministration ──────────────────────────────────────────

async function recordMedicationAdministration(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { prescription_id, patient_id, dose_given, notes, shift_label } = req.body;
  const { hospitalId, userId } = req.user;

  // Verify prescription belongs to this hospital
  const [prescriptions] = await pool.query(
    'SELECT id FROM prescriptions WHERE id = ? AND hospital_id = ?',
    [prescription_id, hospitalId]
  );
  if (!prescriptions.length) {
    return res.status(404).json({ success: false, message: 'Prescription not found' });
  }

  // Verify patient belongs to this hospital
  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patient_id, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [result] = await pool.query(
    `INSERT INTO medication_administration_records
       (hospital_id, prescription_id, patient_id, administered_by, dose_given, notes, shift_label)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [hospitalId, prescription_id, patient_id, userId, dose_given || null, notes || null, shift_label]
  );

  const marId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'mar_entry', marId, req);

  const [rows] = await pool.query(
    `SELECT mar.*,
            u.full_name   AS administered_by_name,
            p.drug_name,
            p.dosage,
            p.frequency
     FROM medication_administration_records mar
     JOIN users u        ON u.id = mar.administered_by
     JOIN prescriptions p ON p.id = mar.prescription_id
     WHERE mar.id = ? AND mar.hospital_id = ?`,
    [marId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getMARByPatient ──────────────────────────────────────────────────────────

async function getMARByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [records] = await pool.query(
    `SELECT mar.*,
            u.full_name    AS administered_by_name,
            p.drug_name,
            p.dosage,
            p.frequency,
            p.route_of_administration
     FROM medication_administration_records mar
     JOIN users u         ON u.id = mar.administered_by
     JOIN prescriptions p ON p.id = mar.prescription_id
     WHERE mar.patient_id = ? AND mar.hospital_id = ?
     ORDER BY mar.administered_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: records });
}

// ─── getMARByPrescription ─────────────────────────────────────────────────────

async function getMARByPrescription(req, res) {
  const { hospitalId } = req.user;
  const prescriptionId = parseInt(req.params.prescriptionId, 10);

  const [prescriptions] = await pool.query(
    'SELECT id, drug_name, dosage, frequency, route_of_administration FROM prescriptions WHERE id = ? AND hospital_id = ?',
    [prescriptionId, hospitalId]
  );
  if (!prescriptions.length) {
    return res.status(404).json({ success: false, message: 'Prescription not found' });
  }

  const [records] = await pool.query(
    `SELECT mar.*, u.full_name AS administered_by_name
     FROM medication_administration_records mar
     JOIN users u ON u.id = mar.administered_by
     WHERE mar.prescription_id = ? AND mar.hospital_id = ?
     ORDER BY mar.administered_at DESC`,
    [prescriptionId, hospitalId]
  );

  return res.json({
    success: true,
    prescription: prescriptions[0],
    data: records,
  });
}

module.exports = {
  createNursingNote,
  getNursingNotesByVisit,
  getNursingNotesByPatient,
  recordMedicationAdministration,
  getMARByPatient,
  getMARByPrescription,
};
