const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── createVisit ──────────────────────────────────────────────────────────────

async function createVisit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { patient_id, visit_type, attending_doctor_id } = req.body;
  const { hospitalId, userId } = req.user;

  // Verify patient belongs to this hospital
  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patient_id, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  // Verify attending doctor belongs to this hospital (if provided)
  if (attending_doctor_id) {
    const [doctors] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND hospital_id = ? AND role = 'doctor' AND is_active = true",
      [attending_doctor_id, hospitalId]
    );
    if (!doctors.length) {
      return res.status(404).json({ success: false, message: 'Attending doctor not found' });
    }
  }

  const [result] = await pool.query(
    `INSERT INTO visits (hospital_id, patient_id, visit_type, attending_doctor_id, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [hospitalId, patient_id, visit_type, attending_doctor_id || null, userId]
  );

  const visitId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'visit', visitId, req);

  const [rows] = await pool.query(
    `SELECT v.*, u.full_name AS attending_doctor_name
     FROM visits v
     LEFT JOIN users u ON u.id = v.attending_doctor_id
     WHERE v.id = ? AND v.hospital_id = ?`,
    [visitId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getVisitsByPatient ───────────────────────────────────────────────────────

async function getVisitsByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [visits] = await pool.query(
    `SELECT v.*,
            u.full_name  AS attending_doctor_name,
            cb.full_name AS created_by_name
     FROM visits v
     LEFT JOIN users u  ON u.id  = v.attending_doctor_id
     LEFT JOIN users cb ON cb.id = v.created_by
     WHERE v.patient_id = ? AND v.hospital_id = ?
     ORDER BY v.visit_date DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: visits });
}

// ─── getVisitById ─────────────────────────────────────────────────────────────

async function getVisitById(req, res) {
  const { hospitalId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [rows] = await pool.query(
    `SELECT v.*,
            p.full_name      AS patient_name,
            p.carri_health_id,
            u.full_name      AS attending_doctor_name,
            cb.full_name     AS created_by_name
     FROM visits v
     JOIN  patients p ON p.id = v.patient_id
     LEFT JOIN users u  ON u.id  = v.attending_doctor_id
     LEFT JOIN users cb ON cb.id = v.created_by
     WHERE v.id = ? AND v.hospital_id = ?`,
    [visitId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  return res.json({ success: true, data: rows[0] });
}

// ─── closeVisit ───────────────────────────────────────────────────────────────

async function closeVisit(req, res) {
  const { hospitalId, userId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [rows] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  if (rows[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Visit is already closed' });
  }

  await pool.query(
    'UPDATE visits SET is_closed = true WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );

  await logAction(userId, hospitalId, 'record_edit', 'visit', visitId, req);

  return res.json({ success: true, message: 'Visit closed successfully' });
}

module.exports = { createVisit, getVisitsByPatient, getVisitById, closeVisit };
