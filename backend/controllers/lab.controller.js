const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── createLabRequest ─────────────────────────────────────────────────────────

async function createLabRequest(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { visit_id, patient_id, test_name, urgency } = req.body;
  const { hospitalId, userId } = req.user;

  const [visits] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visit_id, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }
  if (visits[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Cannot add lab requests to a closed visit' });
  }

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patient_id, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [result] = await pool.query(
    `INSERT INTO lab_requests
       (hospital_id, visit_id, patient_id, test_name, requesting_clinician_id, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [hospitalId, visit_id, patient_id, test_name, userId, urgency]
  );

  const labRequestId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'lab_request', labRequestId, req);

  const [rows] = await pool.query(
    `SELECT lr.*, u.full_name AS requesting_clinician_name
     FROM lab_requests lr
     JOIN users u ON u.id = lr.requesting_clinician_id
     WHERE lr.id = ? AND lr.hospital_id = ?`,
    [labRequestId, hospitalId]
  );

  return res.status(201).json({ success: true, data: rows[0] });
}

// ─── uploadLabResult ──────────────────────────────────────────────────────────

async function uploadLabResult(req, res) {
  const { hospitalId, userId } = req.user;
  const labRequestId = parseInt(req.params.labRequestId, 10);
  const { result_text } = req.body;
  const file = req.file;

  if (!file && (!result_text || !result_text.trim())) {
    return res.status(400).json({
      success: false,
      message: 'At least one of a PDF file or result_text must be provided',
    });
  }

  const [rows] = await pool.query(
    'SELECT id, status FROM lab_requests WHERE id = ? AND hospital_id = ?',
    [labRequestId, hospitalId]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Lab request not found' });
  }

  const updates    = ["status = 'received'", 'result_uploaded_at = NOW()'];
  const values     = [];

  if (file) {
    updates.push('result_pdf_path = ?');
    values.push(`uploads/lab-results/${file.filename}`);
  }
  if (result_text && result_text.trim()) {
    updates.push('result_text = ?');
    values.push(result_text.trim());
  }

  values.push(labRequestId, hospitalId);

  await pool.query(
    `UPDATE lab_requests SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`,
    values
  );

  await logAction(userId, hospitalId, 'record_edit', 'lab_result', labRequestId, req);

  const [updated] = await pool.query(
    `SELECT lr.*, u.full_name AS requesting_clinician_name
     FROM lab_requests lr
     JOIN users u ON u.id = lr.requesting_clinician_id
     WHERE lr.id = ? AND lr.hospital_id = ?`,
    [labRequestId, hospitalId]
  );

  return res.json({ success: true, data: updated[0] });
}

// ─── reviewLabResult ──────────────────────────────────────────────────────────

async function reviewLabResult(req, res) {
  const { hospitalId, userId } = req.user;
  const labRequestId = parseInt(req.params.labRequestId, 10);

  const [rows] = await pool.query(
    'SELECT id, status FROM lab_requests WHERE id = ? AND hospital_id = ?',
    [labRequestId, hospitalId]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Lab request not found' });
  }
  if (rows[0].status === 'pending') {
    return res.status(400).json({ success: false, message: 'Lab result has not been uploaded yet' });
  }
  if (rows[0].status === 'reviewed') {
    return res.status(400).json({ success: false, message: 'Lab result has already been reviewed' });
  }

  await pool.query(
    `UPDATE lab_requests
     SET status = 'reviewed', result_reviewed_by = ?, result_reviewed_at = NOW()
     WHERE id = ? AND hospital_id = ?`,
    [userId, labRequestId, hospitalId]
  );

  await logAction(userId, hospitalId, 'record_edit', 'lab_result_reviewed', labRequestId, req);

  const [updated] = await pool.query(
    `SELECT lr.*,
            u.full_name   AS requesting_clinician_name,
            rv.full_name  AS reviewed_by_name
     FROM lab_requests lr
     JOIN users u         ON u.id  = lr.requesting_clinician_id
     LEFT JOIN users rv   ON rv.id = lr.result_reviewed_by
     WHERE lr.id = ? AND lr.hospital_id = ?`,
    [labRequestId, hospitalId]
  );

  return res.json({ success: true, data: updated[0] });
}

// ─── getLabRequestsByVisit ────────────────────────────────────────────────────

async function getLabRequestsByVisit(req, res) {
  const { hospitalId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [visits] = await pool.query(
    'SELECT id FROM visits WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  const [requests] = await pool.query(
    `SELECT lr.*,
            u.full_name   AS requesting_clinician_name,
            rv.full_name  AS reviewed_by_name
     FROM lab_requests lr
     JOIN users u         ON u.id  = lr.requesting_clinician_id
     LEFT JOIN users rv   ON rv.id = lr.result_reviewed_by
     WHERE lr.visit_id = ? AND lr.hospital_id = ?
     ORDER BY lr.created_at ASC`,
    [visitId, hospitalId]
  );

  return res.json({ success: true, data: requests });
}

// ─── getLabRequestsByPatient ──────────────────────────────────────────────────

async function getLabRequestsByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [requests] = await pool.query(
    `SELECT lr.*,
            u.full_name   AS requesting_clinician_name,
            rv.full_name  AS reviewed_by_name,
            v.visit_type,
            v.visit_date
     FROM lab_requests lr
     JOIN users u         ON u.id  = lr.requesting_clinician_id
     LEFT JOIN users rv   ON rv.id = lr.result_reviewed_by
     JOIN visits v        ON v.id  = lr.visit_id
     WHERE lr.patient_id = ? AND lr.hospital_id = ?
     ORDER BY lr.created_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: requests });
}

// ─── getPendingLabResultsCount ────────────────────────────────────────────────

async function getPendingLabResultsCount(req, res) {
  const { hospitalId } = req.user;

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM lab_requests
     WHERE hospital_id = ? AND status = 'pending'`,
    [hospitalId]
  );

  return res.json({ success: true, data: { count } });
}

module.exports = {
  createLabRequest,
  uploadLabResult,
  reviewLabResult,
  getLabRequestsByVisit,
  getLabRequestsByPatient,
  getPendingLabResultsCount,
};
