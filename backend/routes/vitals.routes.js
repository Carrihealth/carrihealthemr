const express = require('express');
const { body } = require('express-validator');

const { recordVitals, getVitalsByVisit, getVitalsByPatient, getLatestVitals } = require('../controllers/vitals.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const recordRules = [
  body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('blood_pressure_systolic').optional().isInt({ min: 0, max: 300 }).withMessage('Invalid systolic value'),
  body('blood_pressure_diastolic').optional().isInt({ min: 0, max: 200 }).withMessage('Invalid diastolic value'),
  body('temperature_celsius').optional().isFloat({ min: 30, max: 45 }).withMessage('Temperature must be between 30–45 °C'),
  body('pulse_rate').optional().isInt({ min: 0, max: 300 }).withMessage('Invalid pulse rate'),
  body('respiratory_rate').optional().isInt({ min: 0, max: 100 }).withMessage('Invalid respiratory rate'),
  body('spo2_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('SpO2 must be between 0–100'),
  body('weight_kg').optional().isFloat({ min: 0, max: 500 }).withMessage('Invalid weight'),
  body('height_cm').optional().isFloat({ min: 0, max: 300 }).withMessage('Invalid height'),
];

const nurseDoctor    = [authenticateToken, authorize('nurse', 'doctor')];
const clinicalStaff  = [authenticateToken, authorize('doctor', 'nurse', 'admin')];

router.post('/',                        ...nurseDoctor,   recordRules, recordVitals);
router.get('/visit/:visitId',           ...clinicalStaff, getVitalsByVisit);
router.get('/patient/:patientId/latest',...clinicalStaff, getLatestVitals);
router.get('/patient/:patientId',       ...clinicalStaff, getVitalsByPatient);

module.exports = router;
