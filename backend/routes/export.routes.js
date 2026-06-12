const express = require('express');

const { exportPatientRecord } = require('../controllers/export.controller');
const { authenticateToken }   = require('../middleware/auth');
const { authorize }           = require('../middleware/rbac');

const router = express.Router();

router.get('/patient/:patientId',
  authenticateToken,
  authorize('doctor', 'admin', 'super_admin'),
  exportPatientRecord
);

module.exports = router;
