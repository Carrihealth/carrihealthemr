const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const pool      = require('../config/db');
const { logAction } = require('../middleware/audit');

// ─── helpers ──────────────────────────────────────────────────────────────────

function generateHospitalCode(name) {
  const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  return prefix + suffix;
}

function sendValidationError(res, errors) {
  return res.status(422).json({ success: false, errors: errors.array() });
}

// ─── registerHospital ─────────────────────────────────────────────────────────

async function registerHospital(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors);

  const { name, address, phone, email, adminFullName, adminEmail, adminPassword } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Unique hospital_code – retry once on the rare collision
    let hospital_code = generateHospitalCode(name);
    const [existing] = await conn.query(
      'SELECT id FROM hospitals WHERE hospital_code = ?', [hospital_code]
    );
    if (existing.length) hospital_code = generateHospitalCode(name);

    const [hospitalResult] = await conn.query(
      `INSERT INTO hospitals (hospital_code, name, address, phone, email)
       VALUES (?, ?, ?, ?, ?)`,
      [hospital_code, name, address || null, phone || null, email || null]
    );
    const hospitalId = hospitalResult.insertId;

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const [[adminRole]] = await conn.query(
      'SELECT id FROM roles WHERE name = ?', ['admin']
    );
    if (!adminRole) throw new Error('roles table not seeded — run migrations');

    const [userResult] = await conn.query(
      `INSERT INTO users (hospital_id, full_name, email, password_hash, role_id)
       VALUES (?, ?, ?, ?, ?)`,
      [hospitalId, adminFullName, adminEmail, passwordHash, adminRole.id]
    );
    const userId = userResult.insertId;

    // Mark the admin as its own creator
    await conn.query('UPDATE users SET created_by = ? WHERE id = ?', [userId, userId]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Hospital registered successfully',
      data: {
        hospital: { id: hospitalId, hospital_code, name, address, phone, email },
        admin: { id: userId, full_name: adminFullName, email: adminEmail, role: 'admin' },
      },
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already registered for this hospital' });
    }
    throw err;
  } finally {
    conn.release();
  }
}

// ─── login ────────────────────────────────────────────────────────────────────

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors);

  const { email, password, hospital_code } = req.body;

  const [hospitals] = await pool.query(
    'SELECT id, name, hospital_code, is_active FROM hospitals WHERE hospital_code = ?',
    [hospital_code]
  );
  if (!hospitals.length || !hospitals[0].is_active) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const hospital = hospitals[0];

  const [users] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? AND u.hospital_id = ?`,
    [email, hospital.id]
  );
  if (!users.length || !users[0].is_active) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const user = users[0];

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const payload = {
    userId:     user.id,
    hospitalId: hospital.id,
    role:       user.role,
    email:      user.email,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  });

  // Attach minimal user info so logAction can read req.user
  req.user = { id: user.id, email: user.email, role: user.role };
  await logAction(user.id, hospital.id, 'login', null, null, req);

  return res.json({
    success: true,
    token,
    user: {
      id:        user.id,
      full_name: user.full_name,
      email:     user.email,
      role:      user.role,
    },
    hospital: {
      id:            hospital.id,
      name:          hospital.name,
      hospital_code: hospital.hospital_code,
    },
  });
}

// ─── logout ───────────────────────────────────────────────────────────────────

async function logout(req, res) {
  await logAction(req.user.userId, req.user.hospitalId, 'logout', null, null, req);
  return res.json({ success: true, message: 'Logged out successfully' });
}

// ─── getMe ────────────────────────────────────────────────────────────────────

async function getMe(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.is_active, u.created_at,
            r.name AS role,
            h.id AS hospital_id, h.name AS hospital_name, h.hospital_code
     FROM users u
     JOIN roles r    ON r.id = u.role_id
     JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.id = ? AND u.hospital_id = ?`,
    [req.user.userId, req.user.hospitalId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const row = rows[0];
  return res.json({
    success: true,
    data: {
      id:        row.id,
      full_name: row.full_name,
      email:     row.email,
      role:      row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      hospital: {
        id:            row.hospital_id,
        name:          row.hospital_name,
        hospital_code: row.hospital_code,
      },
    },
  });
}

module.exports = { registerHospital, login, logout, getMe };
