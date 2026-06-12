const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const pool          = require('../config/db');
const { logAction } = require('../middleware/audit');

const ADMIN_ALLOWED_ROLES    = ['doctor', 'nurse', 'lab', 'admin'];
const ALL_ROLES              = ['doctor', 'nurse', 'lab', 'admin', 'super_admin'];

// ─── createUser ───────────────────────────────────────────────────────────────

async function createUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { full_name, email, password, role } = req.body;
  const { hospitalId, role: callerRole, userId: callerId } = req.user;

  const allowedRoles = callerRole === 'super_admin' ? ALL_ROLES : ADMIN_ALLOWED_ROLES;
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: `You are not permitted to create a user with role '${role}'`,
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [[roleRow]] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
  if (!roleRow) {
    return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO users (hospital_id, full_name, email, password_hash, role_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hospitalId, full_name, email, passwordHash, roleRow.id, callerId]
    );

    const newUserId = result.insertId;

    await logAction(callerId, hospitalId, 'user_created', 'user', newUserId, req);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: newUserId, hospital_id: hospitalId, full_name, email, role, is_active: true },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already exists in this hospital' });
    }
    throw err;
  }
}

// ─── getUsers ─────────────────────────────────────────────────────────────────

async function getUsers(req, res) {
  const { hospitalId } = req.user;
  const { role } = req.query;

  let sql = `SELECT u.id, u.hospital_id, u.full_name, u.email, r.name AS role,
                    u.is_active, u.created_at, u.created_by
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE u.hospital_id = ?`;
  const params = [hospitalId];

  if (role) {
    sql += ' AND r.name = ?';
    params.push(role);
  }

  sql += ' ORDER BY u.created_at DESC';

  const [rows] = await pool.query(sql, params);

  return res.json({ success: true, data: rows });
}

// ─── deactivateUser ───────────────────────────────────────────────────────────

async function deactivateUser(req, res) {
  const { hospitalId, userId: callerId } = req.user;
  const targetId = parseInt(req.params.userId, 10);

  if (targetId === callerId) {
    return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
  }

  const [rows] = await pool.query(
    'SELECT id, is_active FROM users WHERE id = ? AND hospital_id = ?',
    [targetId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (!rows[0].is_active) {
    return res.status(400).json({ success: false, message: 'User is already inactive' });
  }

  await pool.query(
    'UPDATE users SET is_active = false WHERE id = ? AND hospital_id = ?',
    [targetId, hospitalId]
  );

  await logAction(callerId, hospitalId, 'user_deactivated', 'user', targetId, req);

  return res.json({ success: true, message: 'User deactivated successfully' });
}

// ─── reactivateUser ───────────────────────────────────────────────────────────

async function reactivateUser(req, res) {
  const { hospitalId, userId: callerId } = req.user;
  const targetId = parseInt(req.params.userId, 10);

  const [rows] = await pool.query(
    'SELECT id, is_active FROM users WHERE id = ? AND hospital_id = ?',
    [targetId, hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (rows[0].is_active) {
    return res.status(400).json({ success: false, message: 'User is already active' });
  }

  await pool.query(
    'UPDATE users SET is_active = true WHERE id = ? AND hospital_id = ?',
    [targetId, hospitalId]
  );

  return res.json({ success: true, message: 'User reactivated successfully' });
}

module.exports = { createUser, getUsers, deactivateUser, reactivateUser };
