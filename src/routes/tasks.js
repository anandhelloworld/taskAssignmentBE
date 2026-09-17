const express = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { listTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listTasks);

router.post(
  '/',
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 chars)'),
    body('description').optional().isLength({ max: 2000 }).withMessage('Description too long'),
    body('status').optional().isIn(['pending', 'in-progress', 'completed']).withMessage('Invalid status'),
  ],
  createTask
);

router.put(
  '/:id',
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title cannot be empty'),
    body('description').optional().isLength({ max: 2000 }).withMessage('Description too long'),
    body('status').optional().isIn(['pending', 'in-progress', 'completed']).withMessage('Invalid status'),
  ],
  updateTask
);

router.delete('/:id', deleteTask);

module.exports = router;
