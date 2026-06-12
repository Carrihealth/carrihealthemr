const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── helpers ──────────────────────────────────────────────────────────────────

async function generateCarriHealthId() {
  const digits  = () => String(Math.floor(1000000000 + Math.random() * 9000000000));
  let   id      = 'CID' + digits();
  const [rows]  = await pool.query(
    'SELECT id FROM patients WHERE carri_health_id = ?', [id]
  );
  if (rows.length) id = 'CID' + digits();   // single retry on collision
  return id;
}

const UPDATABLE_FIELDS = [
  'phone', 'address', 'next_of_kin_name',
  'next_of_kin_contact', 'known_allergies', 'pre_existing_conditions',
];

// ─── createPatient ────────────────────────────────────────────────────────────

async function createPatient(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const {
    full_name, date_of_birth, sex, blood_group,
    phone, address, state_of_origin,
    next_of_kin_name, next_of_kin_contact,
    known_allergies, pre_existing_conditions,
  } = req.body;

  const { hospitalId, userId } = req.user;
  const carri_health_id = await generateCarriHealthId();

  const [result] = await pool.query(
    `INSERT INTO patients
       (hospital_id, carri_health_id, full_name, date_of_birth, sex, blood_group,
        phone, address, state_of_origin, next_of_kin_name, next_of_kin_contact,
        known_allergies, pre_existing_conditions, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hospitalId, carri_health_id, full_name, date_of_birth, sex, blood_group,
      phone || null, address || null, state_of_origin || null,
      next_of_kin_name || null, next_of_kin_contact || null,
      known_allergies || null, pre_existing_conditions || null,
      userId,
    ]
  );

  const patientId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'patient', patientId, req);

  const [rows] = await pool.query(
    'SELECT * FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── getPatients ──────────────────────────────────────────────────────────────

async function getPatients(req, res) {
  const { hospitalId, userId } = req.user;
  const search = req.query.search?.trim() || '';
  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let where  = 'WHERE hospital_id = ? AND is_active = true';
  const params = [hospitalId];

  if (search) {
    where += ' AND (full_name LIKE ? OR carri_health_id LIKE ? OR phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM patients ${where}`, params
  );

  const [patients] = await pool.query(
    `SELECT * FROM patients ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  await logAction(userId, hospitalId, 'record_view', 'patient_list', null, req);

  return res.json({
    success: true,
    data: patients,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─── getPatientById ───────────────────────────────────────────────────────────

async function getPatientById(req, res) {
  const { hospitalId, userId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [rows] = await pool.query(
    'SELECT * FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  await logAction(userId, hospitalId, 'record_view', 'patient', patientId, req);

  return res.json({ success: true, data: rows[0] });
}

// ─── updatePatient ────────────────────────────────────────────────────────────

async function updatePatient(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { hospitalId, userId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [existing] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  if (!existing.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  // Build SET clause from only the updatable fields present in the body
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

  values.push(patientId, hospitalId);

  await pool.query(
    `UPDATE patients SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`,
    values
  );

  await logAction(userId, hospitalId, 'record_edit', 'patient', patientId, req);

  const [rows] = await pool.query(
    'SELECT * FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: rows[0] });
}

// ─── deactivatePatient ────────────────────────────────────────────────────────

async function deactivatePatient(req, res) {
  const { hospitalId, userId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [rows] = await pool.query(
    'SELECT id, is_active FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  if (!rows[0].is_active) {
    return res.status(400).json({ success: false, message: 'Patient is already deactivated' });
  }

  await pool.query(
    'UPDATE patients SET is_active = false, deactivated_at = NOW() WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );

  await logAction(userId, hospitalId, 'record_edit', 'patient', patientId, req);

  return res.json({ success: true, message: 'Patient deactivated successfully' });
}

module.exports = { createPatient, getPatients, getPatientById, updatePatient, deactivatePatient };
