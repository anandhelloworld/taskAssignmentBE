const { validationResult } = require('express-validator');
const User = require('../models/User');
const { getVisibleUserIds } = require('../utils/scope');

const SUPERVISOR_FIELDS = 'username email role';

/** Public: lists possible supervisors for a given role, used to populate the registration form. */
async function potentialSupervisors(req, res) {
  const { forRole } = req.query;
  const supervisorRole = forRole === 'teamlead' ? 'manager' : forRole === 'employee' ? 'teamlead' : null;
  if (!supervisorRole) {
    return res.status(400).json({ message: 'forRole must be teamlead or employee' });
  }
  const supervisors = await User.find({ role: supervisorRole }).select('username email role');
  res.json({ supervisors });
}

/** Everyone within the requester's scope (per role hierarchy), excluding themselves. */
async function scopedTeam(req) {
  const visibleIds = await getVisibleUserIds(req.user);
  const otherIds = visibleIds.filter((id) => id.toString() !== req.user._id.toString());
  return User.find({ _id: { $in: otherIds } })
    .select('username email role reportsTo createdAt')
    .sort({ role: 1, username: 1 });
}

/** Authenticated: list of users within the requester's scope (per role hierarchy). */
async function listUsers(req, res) {
  res.json({ users: await scopedTeam(req) });
}

/**
 * Everyone the requester is allowed to assign/reassign a task to (their full scope, excluding
 * self, which is offered separately as "Myself" in the UI). A Manager gets every team lead and
 * every employee; a Team Lead gets their own direct reports; an Employee gets none.
 */
async function myTeam(req, res) {
  if (req.user.role === 'employee') {
    return res.json({ team: [] });
  }
  res.json({ team: await scopedTeam(req) });
}

/**
 * Update a user's profile (username/email) and/or reassign their supervisor (reportsTo).
 *
 * RBAC: a user may always edit themselves. Otherwise the target must be in the requester's
 * scope (Manager: any team lead/employee; Team Lead: their own direct reports). Reassigning
 * `reportsTo` is Manager-only — a Team Lead has no visibility of sibling team leads/managers,
 * so they have no valid destination to move someone into.
 */
async function updateUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const target = await User.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isSelf = target._id.equals(req.user._id);
  if (!isSelf) {
    const visibleIds = await getVisibleUserIds(req.user);
    const inScope = visibleIds.some((id) => id.toString() === target._id.toString());
    if (!inScope) {
      return res.status(404).json({ message: 'User not found' });
    }
  }

  const { username, email, reportsTo } = req.body;

  if (email !== undefined && email.toLowerCase() !== target.email) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: target._id } });
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    target.email = email.toLowerCase();
  }
  if (username !== undefined) {
    target.username = username;
  }

  if (reportsTo !== undefined && reportsTo !== String(target.reportsTo || '')) {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only a manager can reassign a user’s supervisor' });
    }
    if (isSelf || target.role === 'manager') {
      return res.status(400).json({ message: 'Managers do not report to anyone' });
    }

    const newSupervisor = await User.findById(reportsTo);
    if (!newSupervisor) {
      return res.status(400).json({ message: 'Selected supervisor does not exist' });
    }
    const expectedSupervisorRole = target.role === 'teamlead' ? 'manager' : 'teamlead';
    if (newSupervisor.role !== expectedSupervisorRole) {
      return res.status(400).json({ message: `A ${target.role} must report to a ${expectedSupervisorRole}` });
    }

    target.reportsTo = newSupervisor._id;
    target.managerId = target.role === 'teamlead' ? newSupervisor._id : newSupervisor.managerId;

    // Cascade: everyone under a reassigned team lead now has a (possibly) different manager.
    if (target.role === 'teamlead') {
      await User.updateMany({ reportsTo: target._id }, { managerId: target.managerId });
    }
  }

  await target.save();
  await target.populate([
    { path: 'reportsTo', select: SUPERVISOR_FIELDS },
    { path: 'managerId', select: SUPERVISOR_FIELDS },
  ]);
  // Shape matches the list endpoints (_id-keyed), not the self-profile toSafeObject() shape.
  res.json({
    user: {
      _id: target._id,
      username: target.username,
      email: target.email,
      role: target.role,
      reportsTo: target.reportsTo,
      managerId: target.managerId,
    },
  });
}

module.exports = { potentialSupervisors, listUsers, myTeam, updateUser };
