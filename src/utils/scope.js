const User = require('../models/User');

/**
 * Returns the list of user ids the requesting user is allowed to see/act on,
 * per the role hierarchy: manager -> team leads -> employees.
 */
async function getVisibleUserIds(user) {
  if (user.role === 'manager') {
    const teamLeads = await User.find({ role: 'teamlead' }).select('_id');
    const teamLeadIds = teamLeads.map((u) => u._id);
    const employees = await User.find({ reportsTo: { $in: teamLeadIds } }).select('_id');
    return [user._id, ...teamLeadIds, ...employees.map((u) => u._id)];
  }
  if (user.role === 'teamlead') {
    const members = await User.find({ reportsTo: user._id }).select('_id');
    return [user._id, ...members.map((u) => u._id)];
  }
  return [user._id];
}

/** Whether `actor` is allowed to assign/reassign a task to `targetUserId`. */
async function canAssignTo(actor, targetUserId) {
  const visibleIds = await getVisibleUserIds(actor);
  return visibleIds.some((id) => id.toString() === targetUserId.toString());
}

module.exports = { getVisibleUserIds, canAssignTo };
