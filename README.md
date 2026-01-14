# Maths Learner — by SP Sir

Full-stack demo application (Node.js + Express + SQLite) with Stripe Checkout (sandbox) integration.

Features
- Agent accounts (bcrypt-hashed)
- Agent portal: create students
- Student login: Student ID/email + Agent ID + Agent password
- Course listing, enrollments, student dashboard
- Paid courses via Stripe Checkout (test mode)
- SQLite DB and session store (connect-sqlite3)

Important: This is a demo. Do NOT use as-is in production. See "Production notes" below.

## Quickstart (local)

1. Clone or copy the project files into a directory.
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` from `.env.example` and fill values:
   - `SESSION_SECRET`: a random long string
   - `ADMIN_SECRET`: used to protect agent registration endpoint for demo (and also used as seed agent password if none)
   - `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`: your Stripe test keys (from dashboard)
   - `BASE_URL`: e.g. `http://localhost:3000`
4. Start the server:
   ```
   npm start
   ```
   Or for development with auto reload:
   ```
   npm run dev
   ```

5. Open `http://localhost:3000` in your browser.

Seed data:
- Several courses are seeded automatically.
- An initial agent is seeded with id `agentSP` and password equal to the `ADMIN_SECRET` value you set in `.env` (or the fallback shown in console if not provided). Seed logs appear in server console.

Testing payments:
- Click Buy on a paid course and provide a Student ID when prompted.
- You will be redirected to Stripe Checkout (test card numbers such as 4242 4242 4242 4242).
- After payment, Stripe redirects to a success page and the server will confirm the session and enroll the student.

## API endpoints (selected)

- GET /api/courses
- POST /api/agent/register   { adminSecret, agentId, name, email, password }  (protected by ADMIN_SECRET)
- POST /api/agent/login      { agentId, password }
- POST /api/agent/student/create { studentId, name, email }  (agent session required)
- POST /api/student/login    { studentId, agentId, agentPassword }
- GET /api/student/enrollments (student session required)
- POST /api/enroll  { courseId, studentId, agentId, agentPassword } (authorize and enroll)
- POST /api/stripe/create-checkout-session { courseId, studentId } -> returns checkout url
- GET /api/stripe/confirm?session_id=...  -> server confirms and creates enrollment

## Production notes and security checklist

- Use HTTPS and strong secrets.
- Use a persistent DB (Postgres recommended) and a robust session store (Redis).
- Implement proper CSRF protection.
- Use Stripe webhooks to reliably confirm payments (the demo uses session retrieval on success redirect).
- Validate and sanitize inputs server-side.
- Use rate limiting and monitoring.
- Protect agent registration and agent actions (admin approval flow).
- Serve video/content via secure storage (signed URLs or streaming service).

## Next steps I can implement for you (optional)
- Add an Admin UI to manage courses, prices, and agents.
- Add Stripe webhooks to securely fulfill purchases.
- Add Dockerfile + docker-compose for easier deployment.
- Add role-based UI (agent dashboard pages) with nicer UX and templates (React or server-side views).

If you want, I can:
- Add Docker support,
- Implement webhook-based payment confirmation,
- Build a React frontend, or
- Add an Admin UI.

Which would you like next?