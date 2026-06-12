const express = require('express');
const { body }  = require('express-validator');

const { registerHospital, login, logout, getMe } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── validation rules ─────────────────────────────────────────────────────────

const registerRules = [
  body('name').trim().notEmpty().withMessage('Hospital name is required'),
  body('adminFullName').trim().notEmpty().withMessage('Admin full name is required'),
  body('adminEmail').isEmail().normalizeEmail().withMessage('Valid admin email is required'),
  body('adminPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('hospital_code').trim().notEmpty().withMessage('Hospital code is required'),
];

// ─── routes ───────────────────────────────────────────────────────────────────

router.post('/register-hospital', registerRules, registerHospital);
router.post('/login',             loginRules,    login);
router.post('/logout',            authenticateToken, logout);
router.get('/me',                 authenticateToken, getMe);

module.exports = router;
