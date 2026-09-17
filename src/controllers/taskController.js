const { validationResult } = require('express-validator');
const Task = require('../models/Task');
const { getVisibleUserIds, canAssignTo } = require('../utils/scope');
const { roomsForAssignee } = require('../utils/rooms');

async function emitTaskEvent(req, event, task, assigneeId) {
  const io = req.app.get('io');
  if (!io) return;
  const rooms = await roomsForAssignee(assigneeId);
  io.to(rooms).emit(event, task);
}

async function listTasks(req, res) {
  const visibleIds = await getVisibleUserIds(req.user);
  const filter = { assignedTo: { $in: visibleIds } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'username email role')
    .populate('createdBy', 'username email role')
    .sort({ createdAt: -1 });
  res.json({ tasks });
}

async function createTask(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const { title, description, status } = req.body;
  let assignedTo = req.user._id;

  if (req.user.role !== 'employee' && req.body.assignedTo) {
    const allowed = await canAssignTo(req.user, req.body.assignedTo);
    if (!allowed) {
      return res.status(403).json({ message: 'You cannot assign tasks to that user' });
    }
    assignedTo = req.body.assignedTo;
  }

  const task = await Task.create({
    title,
    description,
    status,
    createdBy: req.user._id,
    assignedTo,
  });
  const populated = await task.populate([
    { path: 'assignedTo', select: 'username email role' },
    { path: 'createdBy', select: 'username email role' },
  ]);

  await emitTaskEvent(req, 'task:created', populated, assignedTo);
  res.status(201).json({ task: populated });
}

async function findTaskInScope(req) {
  const visibleIds = await getVisibleUserIds(req.user);
  const task = await Task.findOne({ _id: req.params.id, assignedTo: { $in: visibleIds } });
  return task;
}

async function updateTask(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const task = await findTaskInScope(req);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const { title, description, status, assignedTo } = req.body;
  const previousAssignee = String(task.assignedTo);
  let newAssignee = previousAssignee;
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;

  if (assignedTo !== undefined && assignedTo !== previousAssignee) {
    if (req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employees cannot reassign tasks' });
    }
    const allowed = await canAssignTo(req.user, assignedTo);
    if (!allowed) {
      return res.status(403).json({ message: 'You cannot assign tasks to that user' });
    }
    task.assignedTo = assignedTo;
    newAssignee = assignedTo;
  }

  await task.save();
  // Capture the plain id before populate() mutates task.assignedTo into a full sub-document —
  // passing that populated doc into emitTaskEvent breaks room name string interpolation.
  const populated = await task.populate([
    { path: 'assignedTo', select: 'username email role' },
    { path: 'createdBy', select: 'username email role' },
  ]);

  await emitTaskEvent(req, 'task:updated', populated, previousAssignee);
  if (newAssignee !== previousAssignee) {
    await emitTaskEvent(req, 'task:updated', populated, newAssignee);
  }
  res.json({ task: populated });
}

async function deleteTask(req, res) {
  const task = await findTaskInScope(req);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  const assigneeId = task.assignedTo;
  await task.deleteOne();
  await emitTaskEvent(req, 'task:deleted', { _id: task._id }, assigneeId);
  res.json({ message: 'Task deleted' });
}

module.exports = { listTasks, createTask, updateTask, deleteTask };
