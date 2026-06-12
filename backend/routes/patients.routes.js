const express = require('express');
const { body } = require('express-validator');

const { createPatient, getPatients, getPatientById, updatePatient, deactivatePatient } = require('../controllers/patients.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const VALID_SEX         = ['male', 'female', 'other'];
const VALID_BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

const createRules = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('date_of_birth').isDate().withMessage('Valid date of birth is required (YYYY-MM-DD)'),
  body('sex').isIn(VALID_SEX).withMessage(`Sex must be one of: ${VALID_SEX.join(', ')}`),
  body('blood_group').isIn(VALID_BLOOD_GROUP).withMessage(`Blood group must be one of: ${VALID_BLOOD_GROUP.join(', ')}`),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('state_of_origin').optional().trim(),
  body('next_of_kin_name').optional().trim(),
  body('next_of_kin_contact').optional().trim(),
  body('known_allergies').optional().trim(),
  body('pre_existing_conditions').optional().trim(),
];

const updateRules = [
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('next_of_kin_name').optional().trim(),
  body('next_of_kin_contact').optional().trim(),
  body('known_allergies').optional().trim(),
  body('pre_existing_conditions').optional().trim(),
];

const canWrite   = [authenticateToken, authorize('doctor', 'nurse', 'admin')];
const canRead    = [authenticateToken, authorize('doctor', 'nurse', 'lab', 'admin')];
const adminOnly  = [authenticateToken, authorize('admin', 'super_admin')];

router.post('/',                        ...canWrite,  createRules, createPatient);
router.get('/',                         ...canRead,   getPatients);
router.get('/:patientId',               ...canRead,   getPatientById);
router.patch('/:patientId',             ...canWrite,  updateRules, updatePatient);
router.patch('/:patientId/deactivate',  ...adminOnly, deactivatePatient);

module.exports = router;
