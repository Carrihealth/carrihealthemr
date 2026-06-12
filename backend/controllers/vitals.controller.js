const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

const VITAL_FIELDS = [
  'blood_pressure_systolic', 'blood_pressure_diastolic',
  'temperature_celsius', 'pulse_rate', 'respiratory_rate',
  'spo2_percent', 'weight_kg', 'height_cm',
];

// ─── recordVitals ─────────────────────────────────────────────────────────────

async function recordVitals(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { visit_id, patient_id } = req.body;
  const { hospitalId, userId }   = req.user;

  // At least one vital sign must be present
  const providedVitals = VITAL_FIELDS.filter(
    f => req.body[f] !== undefined && req.body[f] !== null && req.body[f] !== ''
  );
  if (!providedVitals.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one vital sign must be provided',
    });
  }

  // Verify visit belongs to this hospital
  const [visits] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visit_id, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }
  if (visits[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Cannot record vitals for a closed visit' });
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
    `INSERT INTO vitals
       (hospital_id, visit_id, patient_id,
        blood_pressure_systolic, blood_pressure_diastolic,
        temperature_celsius, pulse_rate, respiratory_rate,
        spo2_percent, weight_kg, height_cm,
        created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hospitalId, visit_id, patient_id,
      req.body.blood_pressure_systolic   ?? null,
      req.body.blood_pressure_diastolic  ?? null,
      req.body.temperature_celsius       ?? null,
      req.body.pulse_rate                ?? null,
      req.body.respiratory_rate          ?? null,
      req.body.spo2_percent              ?? null,
      req.body.weight_kg                 ?? null,
      req.body.height_cm                 ?? null,
      userId,
    ]
  );

  const vitalsId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'vitals', vitalsId, req);

  const [rows] = await pool.query(
    'SELECT * FROM vitals WHERE id = ? AND hospital_id = ?',
    [vitalsId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getVitalsByVisit ─────────────────────────────────────────────────────────

async function getVitalsByVisit(req, res) {
  const { hospitalId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [visits] = await pool.query(
    'SELECT id FROM visits WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  const [vitals] = await pool.query(
    `SELECT v.*, u.full_name AS recorded_by_name
     FROM vitals v
     JOIN users u ON u.id = v.created_by
     WHERE v.visit_id = ? AND v.hospital_id = ?
     ORDER BY v.recorded_at DESC`,
    [visitId, hospitalId]
  );

  return res.json({ success: true, data: vitals });
}

// ─── getVitalsByPatient ───────────────────────────────────────────────────────

async function getVitalsByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [vitals] = await pool.query(
    `SELECT v.*,
            u.full_name  AS recorded_by_name,
            vi.visit_type,
            vi.visit_date
     FROM vitals v
     JOIN users u    ON u.id  = v.created_by
     JOIN visits vi  ON vi.id = v.visit_id
     WHERE v.patient_id = ? AND v.hospital_id = ?
     ORDER BY v.recorded_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: vitals });
}

// ─── getLatestVitals ──────────────────────────────────────────────────────────

async function getLatestVitals(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [rows] = await pool.query(
    `SELECT v.*, u.full_name AS recorded_by_name
     FROM vitals v
     JOIN users u ON u.id = v.created_by
     WHERE v.patient_id = ? AND v.hospital_id = ?
     ORDER BY v.recorded_at DESC
     LIMIT 1`,
    [patientId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'No vitals recorded for this patient' });
  }

  return res.json({ success: true, data: rows[0] });
}

module.exports = { recordVitals, getVitalsByVisit, getVitalsByPatient, getLatestVitals };
