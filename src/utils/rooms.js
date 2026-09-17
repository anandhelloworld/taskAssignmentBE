const User = require('../models/User');

/** Every connected user joins this room, so joining it is how we target one specific user. */
function userRoom(userId) {
  return `user:${userId}`;
}

/**
 * Rooms that should receive an update about a task assigned to `assigneeId`:
 * the assignee themselves, their team lead (if any), and all managers
 * (managers can see everyone, per the role hierarchy).
 */
async function roomsForAssignee(assigneeId) {
  const assignee = await User.findById(assigneeId).select('reportsTo role');
  const rooms = new Set(['role:manager', userRoom(assigneeId)]);
  if (assignee?.reportsTo) {
    rooms.add(userRoom(assignee.reportsTo));
  }
  return [...rooms];
}

module.exports = { userRoom, roomsForAssignee };
