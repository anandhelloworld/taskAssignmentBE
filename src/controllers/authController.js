const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

const SUPERVISOR_FIELDS = 'username email role';

function populateSupervisors(user) {
  return user.populate([
    { path: 'reportsTo', select: SUPERVISOR_FIELDS },
    { path: 'managerId', select: SUPERVISOR_FIELDS },
  ]);
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const { username, email, password, role, reportsTo } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  let supervisor = null;
  if ((role === 'teamlead' || role === 'employee') && reportsTo) {
    supervisor = await User.findById(reportsTo);
    if (!supervisor) {
      return res.status(400).json({ message: 'Selected supervisor does not exist' });
    }
    const expectedSupervisorRole = role === 'teamlead' ? 'manager' : 'teamlead';
    if (supervisor.role !== expectedSupervisorRole) {
      return res.status(400).json({ message: `A ${role} must report to a ${expectedSupervisorRole}` });
    }
  }

  // A team lead's manager IS their supervisor; an employee's manager is their team lead's manager.
  let managerId = null;
  if (role === 'teamlead' && supervisor) {
    managerId = supervisor._id;
  } else if (role === 'employee' && supervisor) {
    managerId = supervisor.managerId;
  }

  const user = await User.create({
    username,
    email,
    password,
    role: role || 'employee',
    reportsTo: role === 'manager' ? null : supervisor?._id || null,
    managerId,
  });

  await populateSupervisors(user);
  const token = signToken(user);
  res.status(201).json({ token, user: user.toSafeObject() });
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  await populateSupervisors(user);
  const token = signToken(user);
  res.json({ token, user: user.toSafeObject() });
}

async function me(req, res) {
  await populateSupervisors(req.user);
  res.json({ user: req.user.toSafeObject() });
}

module.exports = { register, login, me };
