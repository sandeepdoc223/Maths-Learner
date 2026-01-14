// server.js - Express server with SQLite + Stripe integration
require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const stripeLib = require("stripe");

const dbModule = require("./db");
const sqlite3 = require("sqlite3").verbose();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin_secret";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeLib(STRIPE_SECRET_KEY);

dbModule.runMigrations();
// seed initial agent using ADMIN_SECRET as demo password if not set: use 'sp@2026' fallback
const seedAgentPassword = ADMIN_SECRET || "sp@2026";
dbModule.seed(seedAgentPassword);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite3", dir: "." }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
  })
);

// serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// helper to open DB a single use
function getDb() {
  return new sqlite3.Database(path.join(__dirname, "data.sqlite3"));
}

// ---------------------------
// Public API
// ---------------------------

// list courses
app.get("/api/courses", (req, res) => {
  const db = getDb();
  db.all(`SELECT id,title,level,price,description FROM courses ORDER BY title`, (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

// agent registration (protected by ADMIN_SECRET for demo)
app.post("/api/agent/register", async (req, res) => {
  const { adminSecret, agentId, name, email, password } = req.body;
  if (adminSecret !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!agentId || !password || !name) return res.status(400).json({ error: "Missing fields" });

  const db = getDb();
  db.get(`SELECT id FROM agents WHERE id = ?`, [agentId], async (err, row) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: "DB error" });
    }
    if (row) {
      db.close();
      return res.status(400).json({ error: "Agent id exists" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO agents (id,name,email,password_hash) VALUES (?,?,?,?)`, [agentId, name, email || "", password_hash], (e) => {
      db.close();
      if (e) return res.status(500).json({ error: "DB insert error" });
      return res.json({ ok: true, agentId });
    });
  });
});

// agent login (for agent portal)
app.post("/api/agent/login", (req, res) => {
  const { agentId, password } = req.body;
  if (!agentId || !password) return res.status(400).json({ error: "Missing fields" });

  const db = getDb();
  db.get(`SELECT id, name, password_hash FROM agents WHERE id = ?`, [agentId], async (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: "DB error" });
    if (!row) return res.status(401).json({ error: "Invalid credentials" });
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // set session as agent
    req.session.agent = { id: row.id, name: row.name };
    res.json({ ok: true, agent: { id: row.id, name: row.name } });
  });
});

// agent creates student account
app.post("/api/agent/student/create", (req, res) => {
  if (!req.session.agent) return res.status(401).json({ error: "Not authenticated as agent" });
  const { studentId, name, email } = req.body;
  if (!studentId || !name) return res.status(400).json({ error: "Missing fields" });
  const db = getDb();
  db.get(`SELECT id FROM students WHERE id = ?`, [studentId], (err, row) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: "DB error" });
    }
    if (row) {
      db.close();
      return res.status(400).json({ error: "Student id exists" });
    }
    db.run(`INSERT INTO students (id,name,email) VALUES (?,?,?)`, [studentId, name, email || ""], (e) => {
      db.close();
      if (e) return res.status(500).json({ error: "DB insert error" });
      return res.json({ ok: true, studentId });
    });
  });
});

// student login (studentId + agentId + agentPassword)
app.post("/api/student/login", (req, res) => {
  const { studentId, agentId, agentPassword } = req.body;
  if (!studentId || !agentId || !agentPassword) return res.status(400).json({ error: "Missing fields" });

  const db = getDb();
  db.get(`SELECT id, name, password_hash FROM agents WHERE id = ?`, [agentId], async (err, agentRow) => {
    if (err || !agentRow) {
      db.close();
      return res.status(401).json({ error: "Invalid agent credentials" });
    }
    const match = await bcrypt.compare(agentPassword, agentRow.password_hash);
    if (!match) {
      db.close();
      return res.status(401).json({ error: "Invalid agent credentials" });
    }

    // ensure student exists; create on-the-fly if missing (common flow)
    db.get(`SELECT id, name FROM students WHERE id = ?`, [studentId], (e, studentRow) => {
      if (e) {
        db.close();
        return res.status(500).json({ error: "DB error" });
      }
      if (!studentRow) {
        // create student
        db.run(`INSERT INTO students (id, name, email) VALUES (?,?,?)`, [studentId, studentId, ""], (ie) => {
          db.close();
          if (ie) return res.status(500).json({ error: "DB insert error" });
          // set session
          req.session.student = { id: studentId, name: studentId, agentId: agentId, agentName: agentRow.name };
          return res.json({ ok: true, student: req.session.student });
        });
      } else {
        db.close();
        req.session.student = { id: studentRow.id, name: studentRow.name, agentId: agentId, agentName: agentRow.name };
        return res.json({ ok: true, student: req.session.student });
      }
    });
  });
});

// logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// get student enrollments (requires student session)
app.get("/api/student/enrollments", (req, res) => {
  if (!req.session.student) return res.status(401).json({ error: "Not logged in as student" });
  const studentId = req.session.student.id;
  const db = getDb();
  db.all(
    `SELECT e.course_id, c.title, c.level, c.price, e.enrolled_at
     FROM enrollments e JOIN courses c ON e.course_id = c.id
     WHERE e.student_id = ?`,
    [studentId],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// enroll endpoint - server-side enrollment (authorized by agent password or via Stripe confirm)
app.post("/api/enroll", async (req, res) => {
  // Accept either:
  // - logged-in student (session) and agentPassword in body to authorize enrollment
  // - Or after Stripe payment confirmation a server-side call will mark enrollment
  const { courseId, agentId, agentPassword, studentId } = req.body;

  // determine student identity
  let sid = studentId;
  if (req.session.student) sid = req.session.student.id;
  if (!sid) return res.status(400).json({ error: "Student id missing" });
  if (!courseId) return res.status(400).json({ error: "Course id missing" });

  // if agentId && agentPassword provided, validate agent
  if (agentId && agentPassword) {
    const db = getDb();
    db.get(`SELECT password_hash FROM agents WHERE id = ?`, [agentId], async (err, row) => {
      if (err || !row) {
        db.close();
        return res.status(401).json({ error: "Invalid agent" });
      }
      const ok = await bcrypt.compare(agentPassword, row.password_hash);
      if (!ok) {
        db.close();
        return res.status(401).json({ error: "Invalid agent credentials" });
      }
      // enroll now
      const id = uuidv4();
      db.run(`INSERT OR IGNORE INTO enrollments (id, student_id, course_id) VALUES (?,?,?)`, [id, sid, courseId], (e) => {
        db.close();
        if (e) return res.status(500).json({ error: "DB error inserting enrollment" });
        return res.json({ ok: true, enrollmentId: id });
      });
    });
    return;
  }

  // Otherwise, require session + server-side confirm via Stripe (handled elsewhere)
  return res.status(400).json({ error: "Missing agent credentials" });
});

// stripe: create checkout session for a course (client posts courseId + studentId)
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  const { courseId, studentId } = req.body;
  if (!courseId || !studentId) return res.status(400).json({ error: "Missing fields" });

  // fetch course
  const db = getDb();
  db.get(`SELECT id, title, price FROM courses WHERE id = ?`, [courseId], async (err, course) => {
    if (err || !course) {
      db.close();
      return res.status(400).json({ error: "Course not found" });
    }
    db.close();

    // create Stripe Checkout session (price in INR rupees -> cents not needed; Stripe expects amount in smallest currency unit)
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "inr",
              unit_amount: course.price * 100,
              product_data: {
                name: course.title,
                description: `Enrollment for ${course.title}`
              }
            },
            quantity: 1
          }
        ],
        success_url: `${BASE_URL}/stripe-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?cancelled=1`,
        metadata: {
          studentId,
          courseId
        }
      });
      res.json({ url: session.url, id: session.id });
    } catch (e) {
      console.error("Stripe error", e);
      res.status(500).json({ error: "Stripe error" });
    }
  });
});

// stripe confirm endpoint (called by frontend on success page)
app.get("/api/stripe/confirm", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "session_id required" });
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session) return res.status(404).json({ error: "session not found" });
    const studentId = session.metadata?.studentId;
    const courseId = session.metadata?.courseId;
    if (!studentId || !courseId) return res.status(400).json({ error: "Missing metadata" });

    // mark enrollment in DB
    const db = getDb();
    const id = uuidv4();
    db.run(`INSERT OR IGNORE INTO enrollments (id, student_id, course_id) VALUES (?,?,?)`, [id, studentId, courseId], (e) => {
      db.close();
      if (e) {
        console.error("Enroll error", e);
        return res.status(500).json({ error: "DB error" });
      }
      return res.json({ ok: true, enrolled: { studentId, courseId } });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Stripe retrieval error" });
  }
});

// agent: list students for agent (requires agent session)
app.get("/api/agent/students", (req, res) => {
  if (!req.session.agent) return res.status(401).json({ error: "Not authenticated" });
  const db = getDb();
  db.all(`SELECT id,name,email,created_at FROM students ORDER BY created_at DESC`, (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

// agent: view student enrollments
app.get("/api/agent/student/:studentId/enrollments", (req, res) => {
  if (!req.session.agent) return res.status(401).json({ error: "Not authenticated" });
  const sid = req.params.studentId;
  const db = getDb();
  db.all(
    `SELECT e.course_id, c.title, c.price, e.enrolled_at
     FROM enrollments e JOIN courses c ON e.course_id = c.id
     WHERE e.student_id = ?`,
    [sid],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// fallback - serve index.html for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});