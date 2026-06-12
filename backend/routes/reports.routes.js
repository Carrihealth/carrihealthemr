const express = require('express');

const { getDashboardStats, getReportsByRange, exportReport } = require('../controllers/reports.controller');
const { authenticateToken }  = require('../middleware/auth');
const { authorize }          = require('../middleware/rbac');

const router = express.Router();

const canView = [authenticateToken, authorize('admin', 'super_admin', 'doctor')];

router.get('/',       ...canView, getDashboardStats);
router.get('/range',  ...canView, getReportsByRange);
router.get('/export', ...canView, exportReport);

module.exports = router;
