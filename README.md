# Task Management — Backend

Express 5 + MongoDB (Mongoose) + JWT + Socket.IO API for a role-based task management app (Manager / Team Lead / Employee).

Live: https://taskassignmentbe.onrender.com/ (frontend: https://task-assignmen-fe.vercel.app/tasks)

## Setup

```bash
npm install
cp .env.example .env   # then edit values
npm run dev            # nodemon, http://localhost:5000
# or: npm start
```

Health check: `GET /api/health` → `{"status":"ok"}`.

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `MONGO_URI` | MongoDB connection string incl. database name |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `CLIENT_ORIGIN` | Frontend origin for CORS/Socket.IO. Falls back to `*` if unset — set it in production |

## Roles & permissions

Users have a `role` (`manager` | `teamlead` | `employee`), a `reportsTo` supervisor (employee → team lead, team lead → manager) and a cached `managerId`.

| | Manager | Team Lead | Employee |
|---|---|---|---|
| See users | all team leads + employees | own team | — |
| See tasks | all | own + team's | own |
| Create task | for anyone or self | for team or self | self only (auto-assigned) |
| Update / delete task | any | own + team's | own |
| Reassign task | to anyone | to team or self | not allowed |
| Edit user profile | anyone in scope | own team | self |
| Reassign user's supervisor | yes (cascades `managerId`) | no | no |

Out-of-scope tasks/users return `404`, not `403`.

## API

All routes except register/login/health/potential-supervisors need `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | `username`, `email`, `password`, `role`, optional `reportsTo` |
| POST | `/api/auth/login` | returns `token` + `user` |
| GET | `/api/auth/me` | current user with populated supervisor + manager |
| GET | `/api/users/potential-supervisors?forRole=teamlead\|employee` | supervisor choices for registration |
| GET | `/api/users` | users in your scope |
| GET | `/api/users/my-team` | users you may assign tasks to |
| PATCH | `/api/users/:id` | update `username`/`email`; `reportsTo` (manager only) |
| GET | `/api/tasks?status=` | tasks in your scope, newest first |
| POST | `/api/tasks` | `title` (required), `description`, `status`, `assignedTo` |
| PUT | `/api/tasks/:id` | update title/description/status/`assignedTo` (reassign) |
| DELETE | `/api/tasks/:id` | delete a task |

Task `status`: `pending` | `in-progress` | `completed`.

## Real-time (Socket.IO)

Connect with `auth: { token }`. Events: `task:created`, `task:updated`, `task:deleted`. Events go only to the assignee, their team lead, and all managers. Note: clients don't re-sync after a dropped connection until the next fetch.

## Demo accounts (on the deployed database)

Password for all: `test@123`

| Role | Email |
|---|---|
| Manager | `m1@gmail.com` … `m3@gmail.com` |
| Team Lead | `l1@gmail.com` … `l9@gmail.com` (l1–l3 under m1, l4–l6 under m2, l7–l9 under m3) |
| Employee | `e1@gmail.com` … `e27@gmail.com` (three per team lead, in order) |

## Notes / assumptions

- Role is self-declared at registration (no admin approval flow).
- `description` is optional; only `title` is required.
- There is no user-delete endpoint.
