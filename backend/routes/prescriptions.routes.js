const express = require('express');
const { body } = require('express-validator');

const {
  createPrescription,
  getPrescriptionsByVisit,
  getPrescriptionsByPatient,
  getActivePrescriptionsCount,
} = require('../controllers/prescriptions.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const createRules = [
  body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('drug_name').trim().notEmpty().withMessage('Drug name is required'),
  body('dosage').trim().notEmpty().withMessage('Dosage is required'),
  body('frequency').trim().notEmpty().withMessage('Frequency is required'),
  body('duration').trim().notEmpty().withMessage('Duration is required'),
  body('route_of_administration').trim().notEmpty().withMessage('Route of administration is required'),
];

const doctorOnly     = [authenticateToken, authorize('doctor')];
const clinicalStaff  = [authenticateToken, authorize('doctor', 'nurse', 'admin')];
const doctorAdmin    = [authenticateToken, authorize('doctor', 'admin')];

router.post('/',                      ...doctorOnly,    createRules, createPrescription);
router.get('/visit/:visitId',         ...clinicalStaff, getPrescriptionsByVisit);
router.get('/patient/:patientId',     ...clinicalStaff, getPrescriptionsByPatient);
router.get('/stats/recent-count',     ...doctorAdmin,   getActivePrescriptionsCount);

module.exports = router;
