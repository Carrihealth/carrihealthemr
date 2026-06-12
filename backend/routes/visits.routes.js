const express = require('express');
const { body } = require('express-validator');

const { createVisit, getVisitsByPatient, getVisitById, closeVisit } = require('../controllers/visits.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const VALID_VISIT_TYPES = ['outpatient', 'inpatient', 'emergency', 'follow_up'];

const createRules = [
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('visit_type').isIn(VALID_VISIT_TYPES).withMessage(`visit_type must be one of: ${VALID_VISIT_TYPES.join(', ')}`),
  body('attending_doctor_id').optional().isInt({ min: 1 }).withMessage('attending_doctor_id must be a valid integer'),
];

const canWrite     = [authenticateToken, authorize('doctor', 'nurse', 'admin')];
const canRead      = [authenticateToken, authorize('doctor', 'nurse', 'lab', 'admin')];
const doctorAdmin  = [authenticateToken, authorize('doctor', 'admin')];

router.post('/',                            ...canWrite,    createRules, createVisit);
router.get('/patient/:patientId',           ...canRead,     getVisitsByPatient);
router.get('/:visitId',                     ...canRead,     getVisitById);
router.patch('/:visitId/close',             ...doctorAdmin, closeVisit);

module.exports = router;
