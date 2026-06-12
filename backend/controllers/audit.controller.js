const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── getAuditLogs ─────────────────────────────────────────────────────────────

async function getAuditLogs(req, res) {
  const { hospitalId } = req.user;
  const { action_type, user_id, date_from, date_to } = req.query;

  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  let where  = 'WHERE hospital_id = ?';
  const params = [hospitalId];

  if (action_type) {
    where += ' AND action_type = ?';
    params.push(action_type);
  }
  if (user_id) {
    where += ' AND user_id = ?';
    params.push(parseInt(user_id, 10));
  }
  if (date_from) {
    where += ' AND created_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    // Include the full day by going to end of that date
    where += ' AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)';
    params.push(date_to);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`, params
  );

  const [logs] = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return res.json({
    success: true,
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─── exportAuditLogs ──────────────────────────────────────────────────────────

async function exportAuditLogs(req, res) {
  const { hospitalId, userId } = req.user;
  const { date_from, date_to } = req.query;

  // Fetch hospital code for the filename
  const [[hospital]] = await pool.query(
    'SELECT hospital_code FROM hospitals WHERE id = ?',
    [hospitalId]
  );

  let where  = 'WHERE al.hospital_id = ?';
  const params = [hospitalId];

  if (date_from) {
    where += ' AND al.created_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    where += ' AND al.created_at <= DATE_ADD(?, INTERVAL 1 DAY)';
    params.push(date_to);
  }

  const [logs] = await pool.query(
    `SELECT al.id, al.user_email, al.user_role, al.action_type,
            al.record_type, al.record_id, al.ip_address, al.created_at
     FROM audit_logs al
     ${where}
     ORDER BY al.created_at DESC`,
    params
  );

  // Log the export action before streaming
  await logAction(userId, hospitalId, 'record_export', 'audit_log', null, req);

  const dateStamp   = new Date().toISOString().slice(0, 10);
  const filename    = `audit_log_${hospital.hospital_code}_${dateStamp}.csv`;
  const CSV_HEADERS = 'id,user_email,user_role,action_type,record_type,record_id,ip_address,created_at';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write header row
  res.write(CSV_HEADERS + '\n');

  // Stream each row — avoids building one giant string in memory
  for (const row of logs) {
    const line = [
      row.id,
      csvEscape(row.user_email),
      csvEscape(row.user_role),
      csvEscape(row.action_type),
      csvEscape(row.record_type),
      row.record_id ?? '',
      csvEscape(row.ip_address),
      row.created_at ? new Date(row.created_at).toISOString() : '',
    ].join(',');
    res.write(line + '\n');
  }

  res.end();
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

module.exports = { getAuditLogs, exportAuditLogs };
