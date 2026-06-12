const express = require('express');
const { body } = require('express-validator');

const {
  createClinicalNote,
  getClinicalNotesByVisit,
  getClinicalNotesByPatient,
  updateClinicalNote,
} = require('../controllers/clinical.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan', 'clerking', 'diagnosis'];

const createRules = [
  body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  ...NOTE_FIELDS.map(f => body(f).optional().trim()),
];

const updateRules = NOTE_FIELDS.map(f => body(f).optional().trim());

const doctorOnly  = [authenticateToken, authorize('doctor')];
const doctorAdmin = [authenticateToken, authorize('doctor', 'admin')];

router.post('/',                          ...doctorOnly,  createRules,  createClinicalNote);
router.get('/visit/:visitId',             ...doctorAdmin, getClinicalNotesByVisit);
router.get('/patient/:patientId',         ...doctorAdmin, getClinicalNotesByPatient);
router.patch('/:noteId',                  ...doctorOnly,  updateRules,  updateClinicalNote);

module.exports = router;
