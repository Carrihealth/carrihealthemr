const express = require('express');
const { body } = require('express-validator');

const { createUser, getUsers, deactivateUser, reactivateUser } = require('../controllers/users.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorize }         = require('../middleware/rbac');

const router = express.Router();

const VALID_ROLES = ['doctor', 'nurse', 'lab', 'admin', 'super_admin'];

const createUserRules = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('role').isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
];

const adminOnly = [authenticateToken, authorize('admin', 'super_admin')];

router.post('/',                    ...adminOnly, createUserRules, createUser);
router.get('/',                     ...adminOnly, getUsers);
router.patch('/:userId/deactivate', ...adminOnly, deactivateUser);
router.patch('/:userId/reactivate', ...adminOnly, reactivateUser);

module.exports = router;
