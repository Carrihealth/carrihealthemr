const express = require('express');

const { getAuditLogs, exportAuditLogs } = require('../controllers/audit.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const canAudit = [authenticateToken, authorize('admin', 'super_admin')];

router.get('/',       ...canAudit, getAuditLogs);
router.get('/export', ...canAudit, exportAuditLogs);

module.exports = router;
