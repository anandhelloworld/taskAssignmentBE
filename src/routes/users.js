const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { potentialSupervisors, listUsers, myTeam, updateUser } = require('../controllers/userController');

const router = express.Router();

router.get('/potential-supervisors', potentialSupervisors);
router.get('/', requireAuth, listUsers);
router.get('/my-team', requireAuth, myTeam);

router.patch(
  '/:id',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid user id'),
    body('username').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Username must be 2-50 characters'),
    body('email').optional().isEmail().withMessage('A valid email is required'),
    body('reportsTo').optional({ nullable: true }).isMongoId().withMessage('Invalid supervisor id'),
  ],
  updateUser
);

module.exports = router;
