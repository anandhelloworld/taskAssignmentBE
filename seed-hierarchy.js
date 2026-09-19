// Seeds 3 managers -> 9 team leads -> 27 employees (m1..m3, l1..l9, e1..e27, password test@123)
// through the running API. Usage: start the server, then `npm run seed:users`.
// API_URL overrides the target (default http://localhost:5000/api). Not idempotent: re-running fails on duplicate emails.
const BASE = process.env.API_URL || 'http://localhost:5000/api';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (res.status >= 300) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function register(username, email, role, reportsTo) {
  const payload = { username, email, password: 'test@123', role };
  if (reportsTo) payload.reportsTo = reportsTo;
  const res = await api('POST', '/auth/register', payload);
  return { username, email, id: res.user.id, token: res.token };
}

async function main() {
  const hierarchy = { managers: [] };

  for (let m = 1; m <= 3; m++) {
    const mgr = await register(`m${m}`, `m${m}@gmail.com`, 'manager');
    console.log(`created manager ${mgr.username} (${mgr.email})`);
    const managerNode = { ...mgr, teamLeads: [] };

    for (let li = 1; li <= 3; li++) {
      const lNum = (m - 1) * 3 + li; // l1..l9 globally
      const lead = await register(`l${lNum}`, `l${lNum}@gmail.com`, 'teamlead', mgr.id);
      console.log(`  created teamlead ${lead.username} (${lead.email}) -> reports to ${mgr.username}`);
      const leadNode = { ...lead, employees: [] };

      for (let ei = 1; ei <= 3; ei++) {
        const eNum = (lNum - 1) * 3 + ei; // e1..e27 globally
        const emp = await register(`e${eNum}`, `e${eNum}@gmail.com`, 'employee', lead.id);
        console.log(`    created employee ${emp.username} (${emp.email}) -> reports to ${lead.username}`);
        leadNode.employees.push(emp);
      }
      managerNode.teamLeads.push(leadNode);
    }
    hierarchy.managers.push(managerNode);
  }

  console.log(`\nDone: ${hierarchy.managers.length} managers, 9 team leads, 27 employees. Password for all: test@123`);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
