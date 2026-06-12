const express = require('express');
const { body } = require('express-validator');

const {
  createNursingNote,
  getNursingNotesByVisit,
  getNursingNotesByPatient,
  recordMedicationAdministration,
  getMARByPatient,
  getMARByPrescription,
} = require('../controllers/nursing.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const VALID_SHIFTS = ['morning', 'afternoon', 'night'];

const noteRules = [
  body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('note_text').trim().notEmpty().withMessage('Note text is required'),
  body('shift_label').isIn(VALID_SHIFTS).withMessage(`shift_label must be one of: ${VALID_SHIFTS.join(', ')}`),
];

const marRules = [
  body('prescription_id').isInt({ min: 1 }).withMessage('Valid prescription_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('shift_label').isIn(VALID_SHIFTS).withMessage(`shift_label must be one of: ${VALID_SHIFTS.join(', ')}`),
  body('dose_given').optional().trim(),
  body('notes').optional().trim(),
];

const nurseOnly     = [authenticateToken, authorize('nurse')];
const nurseDocAdmin = [authenticateToken, authorize('nurse', 'doctor', 'admin')];

// Nursing notes
router.post('/notes',                         ...nurseOnly,     noteRules, createNursingNote);
router.get('/notes/visit/:visitId',           ...nurseDocAdmin, getNursingNotesByVisit);
router.get('/notes/patient/:patientId',       ...nurseDocAdmin, getNursingNotesByPatient);

// Medication administration records
router.post('/mar',                           ...nurseOnly,     marRules, recordMedicationAdministration);
router.get('/mar/patient/:patientId',         ...nurseDocAdmin, getMARByPatient);
router.get('/mar/prescription/:prescriptionId', ...nurseDocAdmin, getMARByPrescription);

module.exports = router;
