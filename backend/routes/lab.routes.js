const express = require('express');
const { body } = require('express-validator');
const multer   = require('multer');

const {
  createLabRequest,
  uploadLabResult,
  reviewLabResult,
  getLabRequestsByVisit,
  getLabRequestsByPatient,
  getPendingLabResultsCount,
} = require('../controllers/lab.controller');
const { uploadLabResult: multerUpload } = require('../config/upload');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const VALID_URGENCY = ['routine', 'urgent', 'stat'];

const createRules = [
  body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
  body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id is required'),
  body('test_name').trim().notEmpty().withMessage('Test name is required'),
  body('urgency').isIn(VALID_URGENCY).withMessage(`urgency must be one of: ${VALID_URGENCY.join(', ')}`),
];

// Multer error handler — converts MulterError into a clean JSON 400
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds 10 MB limit'
      : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  next(err);
}

const doctorNurse    = [authenticateToken, authorize('doctor', 'nurse')];
const labOnly        = [authenticateToken, authorize('lab')];
const doctorOnly     = [authenticateToken, authorize('doctor')];
const allClinical    = [authenticateToken, authorize('doctor', 'nurse', 'lab', 'admin')];
const statsAccess    = [authenticateToken, authorize('admin', 'doctor', 'lab')];

router.post('/',
  ...doctorNurse, createRules, createLabRequest);

router.patch('/:labRequestId/upload',
  ...labOnly,
  multerUpload.single('result_file'),
  handleMulterError,
  uploadLabResult);

router.patch('/:labRequestId/review',
  ...doctorOnly, reviewLabResult);

router.get('/visit/:visitId',
  ...allClinical, getLabRequestsByVisit);

router.get('/patient/:patientId',
  ...allClinical, getLabRequestsByPatient);

router.get('/stats/pending-count',
  ...statsAccess, getPendingLabResultsCount);

module.exports = router;
