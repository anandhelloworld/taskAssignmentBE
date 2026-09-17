const express = require('express');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 2, max: 50 }).withMessage('Username must be 2-50 characters'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['manager', 'teamlead', 'employee']).withMessage('Invalid role'),
  ],
  register
);

router.post(
  '/login',
  [body('email').isEmail().withMessage('A valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  login
);

router.get('/me', requireAuth, me);

module.exports = router;
