const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── allergy conflict detection ───────────────────────────────────────────────

const DRUG_FAMILY_RULES = [
  {
    allergen:  'penicillin',
    drugs:     ['amoxicillin', 'ampicillin'],
    message:   (drug) => `${drug} is a penicillin-class antibiotic and may cross-react with documented penicillin allergy`,
  },
  {
    allergen:  'sulfa',
    drugs:     ['sulfamethoxazole', 'trimethoprim'],
    message:   (drug) => `${drug} belongs to the sulfonamide class; patient has documented sulfa allergy`,
  },
  {
    allergen:  'aspirin',
    drugs:     ['ibuprofen', 'naproxen'],
    message:   (drug) => `${drug} is an NSAID; patient with aspirin allergy may have cross-sensitivity`,
  },
];

function detectAllergyConflict(drugName, knownAllergies) {
  if (!knownAllergies || !knownAllergies.trim()) {
    return { detected: false, detail: null };
  }

  const allergiesLower = knownAllergies.toLowerCase();
  const drugLower      = drugName.toLowerCase();

  // Direct name match
  if (allergiesLower.includes(drugLower)) {
    return {
      detected: true,
      detail:   `Prescribed drug '${drugName}' appears directly in patient's known allergies`,
    };
  }

  // Drug family cross-reactivity rules
  for (const rule of DRUG_FAMILY_RULES) {
    if (allergiesLower.includes(rule.allergen)) {
      const matchedDrug = rule.drugs.find(d => drugLower.includes(d));
      if (matchedDrug) {
        return {
          detected: true,
          detail:   rule.message(drugName),
        };
      }
    }
  }

  return { detected: false, detail: null };
}

// ─── createPrescription ───────────────────────────────────────────────────────

async function createPrescription(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const {
    visit_id, patient_id,
    drug_name, dosage, frequency, duration, route_of_administration,
  } = req.body;
  const { hospitalId, userId } = req.user;

  // Verify visit belongs to this hospital and is open
  const [visits] = await pool.query(
    'SELECT id, is_closed FROM visits WHERE id = ? AND hospital_id = ?',
    [visit_id, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }
  if (visits[0].is_closed) {
    return res.status(400).json({ success: false, message: 'Cannot add prescriptions to a closed visit' });
  }

  // Fetch patient (also verifies hospital ownership) and known_allergies
  const [patients] = await pool.query(
    'SELECT id, known_allergies FROM patients WHERE id = ? AND hospital_id = ?',
    [patient_id, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const { detected: conflictDetected, detail: conflictDetail } =
    detectAllergyConflict(drug_name, patients[0].known_allergies);

  const [result] = await pool.query(
    `INSERT INTO prescriptions
       (hospital_id, visit_id, patient_id, drug_name, dosage, frequency, duration,
        route_of_administration, prescribing_doctor_id,
        allergy_conflict_detected, allergy_conflict_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hospitalId, visit_id, patient_id, drug_name, dosage, frequency, duration,
      route_of_administration, userId,
      conflictDetected, conflictDetail,
    ]
  );

  const prescriptionId = result.insertId;

  await logAction(userId, hospitalId, 'record_create', 'prescription', prescriptionId, req);

  const [rows] = await pool.query(
    `SELECT p.*, u.full_name AS prescribing_doctor_name
     FROM prescriptions p
     JOIN users u ON u.id = p.prescribing_doctor_id
     WHERE p.id = ? AND p.hospital_id = ?`,
    [prescriptionId, hospitalId]
  );

  const status = conflictDetected ? 201 : 201;   // always 201; conflict is surfaced in body
  return res.status(status).json({
    success: true,
    allergyConflict: conflictDetected,
    conflictDetail:  conflictDetail,
    data:            rows[0],
  });
}

// ─── getPrescriptionsByVisit ──────────────────────────────────────────────────

async function getPrescriptionsByVisit(req, res) {
  const { hospitalId } = req.user;
  const visitId = parseInt(req.params.visitId, 10);

  const [visits] = await pool.query(
    'SELECT id FROM visits WHERE id = ? AND hospital_id = ?',
    [visitId, hospitalId]
  );
  if (!visits.length) {
    return res.status(404).json({ success: false, message: 'Visit not found' });
  }

  const [prescriptions] = await pool.query(
    `SELECT p.*, u.full_name AS prescribing_doctor_name
     FROM prescriptions p
     JOIN users u ON u.id = p.prescribing_doctor_id
     WHERE p.visit_id = ? AND p.hospital_id = ?
     ORDER BY p.created_at ASC`,
    [visitId, hospitalId]
  );

  return res.json({ success: true, data: prescriptions });
}

// ─── getPrescriptionsByPatient ────────────────────────────────────────────────

async function getPrescriptionsByPatient(req, res) {
  const { hospitalId } = req.user;
  const patientId = parseInt(req.params.patientId, 10);

  const [patients] = await pool.query(
    'SELECT id FROM patients WHERE id = ? AND hospital_id = ?',
    [patientId, hospitalId]
  );
  if (!patients.length) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  const [prescriptions] = await pool.query(
    `SELECT p.*,
            u.full_name  AS prescribing_doctor_name,
            v.visit_type,
            v.visit_date
     FROM prescriptions p
     JOIN users u   ON u.id  = p.prescribing_doctor_id
     JOIN visits v  ON v.id  = p.visit_id
     WHERE p.patient_id = ? AND p.hospital_id = ?
     ORDER BY p.created_at DESC`,
    [patientId, hospitalId]
  );

  return res.json({ success: true, data: prescriptions });
}

// ─── getActivePrescriptionsCount ──────────────────────────────────────────────

async function getActivePrescriptionsCount(req, res) {
  const { hospitalId } = req.user;

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM prescriptions
     WHERE hospital_id = ?
       AND created_at >= NOW() - INTERVAL 7 DAY`,
    [hospitalId]
  );

  return res.json({ success: true, data: { count, period: 'last_7_days' } });
}

module.exports = {
  createPrescription,
  getPrescriptionsByVisit,
  getPrescriptionsByPatient,
  getActivePrescriptionsCount,
};
