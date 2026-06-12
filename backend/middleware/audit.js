const pool = require('../config/db');

/**
 * Insert a row into audit_logs.
 * Call this manually from controllers after a significant action.
 *
 * @param {number|null} userId
 * @param {number|null} hospitalId
 * @param {string}      actionType  - must match the audit_logs ENUM
 * @param {string|null} recordType  - e.g. 'patient', 'visit', 'prescription'
 * @param {number|null} recordId
 * @param {object}      req         - Express request (used for IP and user metadata)
 */
async function logAction(userId, hospitalId, actionType, recordType, recordId, req) {
  try {
    const userEmail = req?.user?.email   || null;
    const userRole  = req?.user?.role    || null;
    const ipAddress = req?.ip
      || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
      || null;

    await pool.query(
      `INSERT INTO audit_logs
         (hospital_id, user_id, user_email, user_role, action_type, record_type, record_id, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [hospitalId, userId, userEmail, userRole, actionType, recordType, recordId, ipAddress]
    );
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAction };
