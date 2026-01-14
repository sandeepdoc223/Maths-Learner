// public/app.js - frontend interactions (vanilla JS)
const coursesListEl = document.getElementById("courses-list");
const totalCoursesEl = document.getElementById("total-courses");
const modal = document.getElementById("modal-login");
const modalClose = document.getElementById("modal-close");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const btnOpenLogin = document.getElementById("btn-open-login");

const modalAgent = document.getElementById("modal-agent");
const modalAgentClose = document.getElementById("modal-agent-close");
const btnOpenAgent = document.getElementById("btn-open-agent");
const agentLoginForm = document.getElementById("agent-login-form");
const agentLoginStatus = document.getElementById("agent-login-status");

const dashboardSection = document.getElementById("dashboard");
const welcomeStudent = document.getElementById("welcome-student");
const enrolledEl = document.getElementById("enrolled");
const btnLogout = document.getElementById("btn-logout");

const agentPortal = document.getElementById("agent-portal");
const agentWelcome = document.getElementById("agent-welcome");
const createStudentForm = document.getElementById("create-student-form");
const createStudentStatus = document.getElementById("create-student-status");
const agentStudentsList = document.getElementById("agent-students-list");
const btnAgentLogout = document.getElementById("btn-agent-logout");

document.getElementById("year").textContent = new Date().getFullYear();

function fetchCourses() {
  fetch("/api/courses").then(r=>r.json()).then(courses=>{
    totalCoursesEl.textContent = courses.length;
    coursesListEl.innerHTML = "";
    courses.forEach(course=>{
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h4>${escapeHtml(course.title)}</h4>
        <div class="muted">${escapeHtml(course.level)} • Price: ₹${course.price}</div>
        <p class="muted small">${escapeHtml(course.description || "")}</p>
        <div style="margin-top:10px;">
          <button class="btn" data-action="details" data-id="${course.id}">Details</button>
          <button class="btn primary" data-action="buy" data-id="${course.id}" data-price="${course.price}">${course.price>0 ? 'Buy' : 'Enroll (free)'}</button>
        </div>
      `;
      coursesListEl.appendChild(card);
    });
  });
}
fetchCourses();

function escapeHtml(s){ if(!s) return ""; return s.replace(/[&<>"'`=\/]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); });}

// modal controls
function openModal(){ modal.classList.remove("hidden"); loginStatus.textContent = ""; loginForm.reset(); document.getElementById("student-id").focus(); }
function closeModal(){ modal.classList.add("hidden"); }
btnOpenLogin?.addEventListener("click", openModal);
modalClose?.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target===modal) closeModal(); });
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

// agent modal
function openAgentModal(){ modalAgent.classList.remove("hidden"); agentLoginStatus.textContent=""; agentLoginForm.reset(); document.getElementById("agent-login-id").focus(); }
function closeAgentModal(){ modalAgent.classList.add("hidden"); }
btnOpenAgent?.addEventListener("click", openAgentModal);
modalAgentClose?.addEventListener("click", closeAgentModal);
modalAgent.addEventListener("click", (e)=>{ if(e.target===modalAgent) closeAgentModal(); });

// login form
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginStatus.textContent = "Logging in...";
  const studentId = document.getElementById("student-id").value.trim();
  const agentId = document.getElementById("agent-id").value.trim();
  const agentPassword = document.getElementById("agent-password").value;
  const res = await fetch("/api/student/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, agentId, agentPassword })
  });
  const data = await res.json();
  if (!res.ok) {
    loginStatus.textContent = data.error || "Login failed";
    return;
  }
  loginStatus.textContent = "Login successful";
  closeModal();
  showStudentDashboard(data.student);
});

// agent login
agentLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  agentLoginStatus.textContent = "Logging in...";
  const agentId = document.getElementById("agent-login-id").value.trim();
  const agentPassword = document.getElementById("agent-login-password").value;
  const res = await fetch("/api/agent/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, password: agentPassword })
  });
  const data = await res.json();
  if (!res.ok) {
    agentLoginStatus.textContent = data.error || "Login failed";
    return;
  }
  agentLoginStatus.textContent = "Login successful";
  closeAgentModal();
  showAgentPortal(data.agent);
});

// show agent portal
function showAgentPortal(agent) {
  agentPortal.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  agentWelcome.innerHTML = `<strong>Welcome, ${escapeHtml(agent.name)} (Agent ID: ${escapeHtml(agent.id)})</strong>`;
  loadAgentStudents();
}

async function loadAgentStudents() {
  const res = await fetch("/api/agent/students");
  if (!res.ok) {
    agentStudentsList.innerHTML = `<p class="muted">Unable to load students. (Are you logged in as agent?)</p>`;
    return;
  }
  const students = await res.json();
  agentStudentsList.innerHTML = students.length ? students.map(s => `<div class="card"><strong>${escapeHtml(s.name)}</strong><div class="muted">${escapeHtml(s.id)} • ${escapeHtml(s.email || "")}</div></div>`).join("") : `<p class="muted">No students yet.</p>`;
}

// create student form
createStudentForm?.addEventListener("submit", async (e)=> {
  e.preventDefault();
  createStudentStatus.textContent = "Creating...";
  const studentId = document.getElementById("new-student-id").value.trim();
  const name = document.getElementById("new-student-name").value.trim();
  const email = document.getElementById("new-student-email").value.trim();
  const res = await fetch("/api/agent/student/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, name, email })
  });
  const data = await res.json();
  if (!res.ok) {
    createStudentStatus.textContent = data.error || "Error";
    return;
  }
  createStudentStatus.textContent = "Student created.";
  createStudentForm.reset();
  loadAgentStudents();
});

// buy / enroll button handling
coursesListEl.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  const price = Number(btn.getAttribute("data-price") || 0);
  if (action === "details") {
    alert("Details: " + id);
  } else if (action === "buy") {
    // ask for student id to pay if not logged in (simpler flow)
    let studentId = prompt("Enter your Student ID or email:");
    if (!studentId) return;
    if (price <= 0) {
      // free enroll: ask for agent credentials to authorize
      const agentId = prompt("Enter Agent ID to authorize enrollment:");
      if (!agentId) return;
      const agentPassword = prompt("Enter Agent password:");
      if (!agentPassword) return;
      const resp = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id, studentId, agentId, agentPassword })
      });
      const js = await resp.json();
      alert(js.ok ? "Enrolled successfully (free course)." : ("Error: " + (js.error || "Unknown")));
      return;
    }
    // for paid course create stripe checkout session
    const createResp = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: id, studentId })
    });
    const createData = await createResp.json();
    if (!createResp.ok) {
      alert("Error creating checkout: " + (createData.error || ""));
      return;
    }
    // redirect to Stripe Checkout page (session.url)
    window.location = createData.url;
  }
});

// after successful stripe checkout, the success page will redirect to stripe-success.html with session_id param
// BUT our simple flow: when redirected back to /stripe-success.html the page will call /api/stripe/confirm?session_id=...
// See stripe-success.html (below) — implemented as a separate static file.

function showStudentDashboard(student) {
  if (!student) {
    dashboardSection.classList.add("hidden");
    return;
  }
  dashboardSection.classList.remove("hidden");
  agentPortal.classList.add("hidden");
  welcomeStudent.innerHTML = `<strong>Welcome, ${escapeHtml(student.id)}</strong><p class="muted">Authorized by: ${escapeHtml(student.agentName)} (Agent ID: ${escapeHtml(student.agentId)})</p>`;
  loadEnrollments();
}

async function loadEnrollments() {
  const res = await fetch("/api/student/enrollments");
  if (!res.ok) {
    enrolledEl.innerHTML = `<div class="card"><p class="muted">Not logged in or no enrollments.</p></div>`;
    return;
  }
  const rows = await res.json();
  if (rows.length === 0) {
    enrolledEl.innerHTML = `<div class="card"><p class="muted">No enrolled courses yet.</p></div>`;
    return;
  }
  enrolledEl.innerHTML = rows.map(r => `<div class="card"><h4>${escapeHtml(r.title)}</h4><div class="muted">Price: ₹${r.price} • Enrolled: ${r.enrolled_at}</div></div>`).join("");
}

// logout
btnLogout?.addEventListener("click", async ()=> {
  await fetch("/api/logout", { method: "POST" });
  dashboardSection.classList.add("hidden");
  alert("Logged out");
});
btnAgentLogout?.addEventListener("click", async ()=> {
  await fetch("/api/logout", { method: "POST" });
  agentPortal.classList.add("hidden");
  alert("Agent logged out");
});

// on load: check if session exists by trying to fetch enrollments
(async function init(){
  // try to detect existing student session
  const r = await fetch("/api/student/enrollments");
  if (r.ok) {
    // we are logged in as student
    // but server doesn't return student metadata so show dashboard basic
    showStudentDashboard({ id: "(You)", agentName: "", agentId: "" });
    loadEnrollments();
  }
  // try agent session
  const agentCheck = await fetch("/api/agent/students");
  if (agentCheck.ok) {
    // show agent portal (but fetch agent info is not returned; user can continue)
    agentPortal.classList.remove("hidden");
    loadAgentStudents();
  }
})();