// Creates sample tasks and reassigns one across teams, using the users from seed-hierarchy.js.
// Usage: `npm run seed:tasks` (run seed:users first). API_URL overrides the target (default http://localhost:5000/api).
const BASE = process.env.API_URL || 'http://localhost:5000/api';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (res.status >= 300) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login(email, password) {
  const r = await api('POST', '/auth/login', { email, password });
  return { token: r.token, id: r.user.id, username: r.user.username };
}

async function main() {
  const e1 = await login('e1@gmail.com', 'test@123');
  const e2 = await login('e2@gmail.com', 'test@123');
  const e10 = await login('e10@gmail.com', 'test@123'); // under l4 -> m2
  const l1 = await login('l1@gmail.com', 'test@123');
  const l4 = await login('l4@gmail.com', 'test@123');
  const m1 = await login('m1@gmail.com', 'test@123');
  console.log('logged in e1,e2,e10,l1,l4,m1');

  // e1 creates own task
  const t1 = await api('POST', '/tasks', { title: 'e1 self task', description: 'Employee-created task for self' }, e1.token);
  console.log('e1 created task:', t1.task.title, '-> assignedTo', t1.task.assignedTo.username);

  // l1 creates a task for e2 (own team)
  const t2 = await api('POST', '/tasks', { title: 'l1 -> e2 task', description: 'Team lead assigns within own team', assignedTo: e2.id }, l1.token);
  console.log('l1 created task for e2:', t2.task.title, '-> assignedTo', t2.task.assignedTo.username);

  // m1 creates a task assigned to l4 (a team lead under a DIFFERENT manager, m2) - manager's global reach
  const t3 = await api('POST', '/tasks', { title: 'm1 -> l4 task', description: 'Manager assigns across the whole org, not just own reports', assignedTo: l4.id }, m1.token);
  console.log('m1 created task for l4 (different manager\'s team):', t3.task.title, '-> assignedTo', t3.task.assignedTo.username);

  // Reassign t1 (e1's own task) from e1 to e10 - a full cross-team, cross-manager reassignment, done by the manager
  const reassigned = await api('PUT', `/tasks/${t1.task._id}`, { assignedTo: e10.id }, m1.token);
  console.log('manager reassigned e1\'s task to e10 (different team, different manager):', reassigned.task.assignedTo.username);

  // Verify: e1 no longer sees it, e10 now does
  const e1Tasks = await api('GET', '/tasks', null, e1.token);
  const e10Tasks = await api('GET', '/tasks', null, e10.token);
  console.log('e1 still sees reassigned task?', e1Tasks.tasks.some((t) => t._id === t1.task._id), '(expect false)');
  console.log('e10 now sees reassigned task?', e10Tasks.tasks.some((t) => t._id === t1.task._id), '(expect true)');

  // l1 marks their own task complete (status update)
  const t4 = await api('POST', '/tasks', { title: 'l1 self task to complete', description: 'Will be marked completed' }, l1.token);
  await api('PUT', `/tasks/${t4.task._id}`, { status: 'completed' }, l1.token);
  console.log('l1 created + completed own task:', t4.task.title);

  console.log('\nDONE. Summary:');
  console.log('- t1 (e1 self task):', t1.task._id, '-> reassigned to e10');
  console.log('- t2 (l1 -> e2):', t2.task._id);
  console.log('- t3 (m1 -> l4, cross-manager):', t3.task._id);
  console.log('- t4 (l1 self, completed):', t4.task._id);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
