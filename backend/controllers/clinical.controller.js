const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

const UPDATABLE_FIELDS = ['subjective', 'objective', 'assessment', 'plan', 'clerking', 'diagnosis'];

// ─── createClinicalNote ───────────────────────────────────────────────────────

async function createClinicalNote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { visit_id, patient_id, subjective, objective, assessment, plan, clerking, diagnosis } = req.body;
  const { hospitalId, userId } = req.user;

  // Verify visit belongs to this hospital
  const [visits] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visit_id, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }
  if (visits[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Cannot add notes to a closed visit' });
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
    `INSERT INTO clinical_notes
       (hospital_id, visit_id, patient_id, subjective, objective, assessment, plan, clerking, diagnosis, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hospitalId, visit_id, patient_id,
      subjective || null, objective || null, assessment || null,
      plan || null, clerking || null, diagnosis || null,
      userId,
    ]
  );

  const noteId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'clinical_note', noteId, req);

  const [rows] = await pool.query(
    'SELECT * FROM clinical_notes WHERE id = ? AND hospital_id = ?',
    [noteId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getClinicalNotesByVisit ──────────────────────────────────────────────────

async function getClinicalNotesByVisit(req, res) {
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
    `SELECT cn.*, u.full_name AS created_by_name
     FROM clinical_notes cn
     JOIN users u ON u.id = cn.created_by
     WHERE cn.visit_id = ? AND cn.hospital_id = ?
     ORDER BY cn.created_at ASC`,
    [visitId, hospitalId]
  );

  return res.json({ success: true, data: notes });
}

// ─── getClinicalNotesByPatient ────────────────────────────────────────────────

async function getClinicalNotesByPatient(req, res) {
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
    `SELECT cn.*,
            u.full_name  AS created_by_name,
            v.visit_type,
            v.visit_date
     FROM clinical_notes cn
     JOIN users u    ON u.id  = cn.created_by
     JOIN visits v   ON v.id  = cn.visit_id
     WHERE cn.patient_id = ? AND cn.hospital_id = ?
     ORDER BY cn.created_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: notes });
}

// ─── updateClinicalNote ───────────────────────────────────────────────────────

async function updateClinicalNote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { hospitalId, userId } = req.user;
  const noteId = parseInt(req.params.noteId, 10);

  const [rows] = await pool.query(
    'SELECT id, created_by FROM clinical_notes WHERE id = ? AND hospital_id = ?',
    [noteId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Clinical note not found' });
  }

  // Doctors can only edit their own notes
  if (rows[0].created_by !== userId) {
    return res.status(403).json({ success: false, message: 'You can only edit your own clinical notes' });
  }

  const updates = [];
  const values  = [];

  for (const field of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates.push(`${field} = ?`);
      values.push(req.body[field] ?? null);
    }
  }

  if (!updates.length) {
    return res.status(400).json({ success: false, message: 'No updatable fields provided' });
  }

  values.push(noteId, hospitalId);

  await pool.query(
    `UPDATE clinical_notes SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`,
    values
  );

  await logAction(userId, hospitalId, 'record_edit', 'clinical_note', noteId, req);

  const [updated] = await pool.query(
    'SELECT * FROM clinical_notes WHERE id = ? AND hospital_id = ?',
    [noteId, hospitalId]
  );

  return res.json({ success: true, data: updated[0] });
}

module.exports = {
  createClinicalNote,
  getClinicalNotesByVisit,
  getClinicalNotesByPatient,
  updateClinicalNote,
};
