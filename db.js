// db.js - simple sqlite helper and seed
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_PATH = path.join(__dirname, "data.sqlite3");

function open() {
  const db = new sqlite3.Database(DB_PATH);
  return db;
}

function runMigrations() {
  const db = open();

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        level TEXT,
        price INTEGER DEFAULT 0,
        description TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id)
      );
    `);
  });

  db.close();
}

async function seed(initialAgentPassword) {
  const db = open();

  // Insert seed courses and an agent if missing
  db.serialize(async () => {
    // check if any course exists
    db.get(`SELECT COUNT(*) as c FROM courses`, (err, row) => {
      if (err) {
        console.error(err);
        return;
      }
      if (row.c === 0) {
        const courses = [
          { id: "cbse-9-10", title: "CBSE Class 9–10 Complete Pack", level: "CBSE", price: 499, description: "Theory, examples, practice & tests for class 9-10." },
          { id: "cbse-11-12", title: "CBSE Class 11–12 Complete Pack", level: "CBSE", price: 899, description: "Comprehensive coverage for class 11-12." },
          { id: "jee-mains", title: "JEE Main Preparation", level: "JEE", price: 1199, description: "Topicwise JEE Main prep with tests." },
          { id: "iit-adv", title: "IIT Advanced Course", level: "IIT", price: 1499, description: "Advanced problem solving for IIT aspirants." },
          { id: "nda", title: "NDA Maths Complete", level: "NDA", price: 799, description: "Mathematics for NDA exam pattern." },
          { id: "uptgtpgt", title: "UP TGT / PGT Maths Course", level: "UP-TGT/PGT", price: 999, description: "Preparation content for TGT/PGT posts." }
        ];
        const stmt = db.prepare(`INSERT INTO courses (id,title,level,price,description) VALUES (?,?,?,?,?)`);
        for (const c of courses) {
          stmt.run(c.id, c.title, c.level, c.price, c.description);
        }
        stmt.finalize();
        console.log("Seeded courses.");
      }
    });

    // check if any agent exists
    db.get(`SELECT COUNT(*) as c FROM agents`, async (err, row) => {
      if (err) {
        console.error(err);
        return;
      }
      if (row.c === 0) {
        const agentId = "agentSP";
        const passwordHash = await bcrypt.hash(initialAgentPassword, 10);
        db.run(
          `INSERT INTO agents (id,name,email,password_hash) VALUES (?,?,?,?)`,
          agentId,
          "SP Sir",
          "sp@example.com",
          passwordHash,
          (err2) => {
            if (err2) console.error("Error seeding agent:", err2);
            else console.log(`Seeded agent: id=${agentId} password=${initialAgentPassword}`);
          }
        );
      }
    });
  });

  db.close();
}

module.exports = {
  open,
  runMigrations,
  seed
};