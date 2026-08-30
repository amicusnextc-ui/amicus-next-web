const directory = window.AMICUS_MATCHING_DEPARTMENTS;
const storageKeys = window.AMICUS_STORAGE;

const DEPARTMENT_IMAGES = {
  preschool: { src: "assets/department-preschool-2026.png", alt: "나무 블록을 쌓는 유아-유치부의 손" },
  elementaryJr: { src: "assets/department-kids-2026.png", alt: "크레용과 그림책이 놓인 유년부의 책상" },
  elementary: { src: "assets/department-elementary-2026.png", alt: "노트와 연필이 놓인 초등부의 책상" },
  youth: { src: "assets/department-youth-2026.png", alt: "지도와 가죽 노트가 놓인 중고등부의 책상" }
};

function readApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.applications) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function readAssignment() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
  } catch {
    return null;
  }
}

// Students with no partner yet — the same figure partner.html gates on.
let serverAvailability = null;

function waitingByDepartment() {
  if (serverAvailability) {
    return Object.fromEntries(
      Object.keys(directory).map((key) => [key, serverAvailability.departments?.[key] ?? 0])
    );
  }
  const assigned = new Set(readApplications().map((application) => application.studentId));
  return Object.fromEntries(
    Object.entries(directory).map(([key, department]) => [
      key,
      department.students.filter((student) => !assigned.has(student.id)).length
    ])
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

// Four cards of one shape: the department name leads, the grade range supports.
function departmentCard(key, department, waiting) {
  const image = DEPARTMENT_IMAGES[key];
  const staffCount = window.AMICUS_DIRECTORY[key].staff.length;
  return `
    <a class="department-card" href="department.html?dept=${key}">
      <span class="department-card-photo">
        <img src="${image.src}" alt="${escapeHtml(image.alt)}" loading="lazy">
      </span>
      <span class="department-card-body">
        <span class="department-card-name">${escapeHtml(department.name)}</span>
        <span class="department-card-range">${escapeHtml(department.range)}<span class="department-card-latin">${escapeHtml(department.english)}</span></span>
        <span class="department-card-counts">
          <span>학생 <b>${department.students.length}</b></span>
          <span>간사 <b>${staffCount}</b></span>
        </span>
        ${waiting > 0 ? `<span class="department-card-waiting">${waiting}명 대기</span>` : ""}
        <span class="department-card-link">${escapeHtml(department.name)} 보기 →</span>
      </span>
    </a>`;
}

// The printed poster's QR lands here, not on the form, and the event code is
// printed beside it for the reader to type. Carrying the code on every apply
// link spares them that step — and keeps working if the poster is reprinted
// with a direct link.
function applyHref() {
  const code = window.AMICUS_EVENT?.applicationCode;
  return code ? `partner.html?code=${encodeURIComponent(code)}` : "partner.html";
}

function render() {
  const waiting = waitingByDepartment();
  const total = Object.values(waiting).reduce((sum, count) => sum + count, 0);

  const href = applyHref();
  document.querySelectorAll('a[href="partner.html"]').forEach((link) => {
    link.href = href;
  });

  document.querySelector("#departmentGrid").innerHTML = Object.entries(directory)
    .map(([key, department]) => departmentCard(key, department, waiting[key]))
    .join("");

  document.querySelector("#homeWaitingTotal").textContent = String(total);

  const pill = document.querySelector("#waitingPill");
  pill.hidden = total === 0;
  pill.textContent = `파트너 대기 ${total}명`;

  // A partner returning mid-semester wants their student, not the form.
  const assignment = readAssignment();
  document.querySelector("#myPrayerLink").hidden = !assignment;
  document.querySelector("#applyLink").classList.toggle("is-only-action", !assignment);
}

render();

window.AMICUS_AVAILABILITY?.then((availability) => {
  if (availability && availability.departments) {
    serverAvailability = availability;
    render();
  }
});
const directory = window.AMICUS_MATCHING_DEPARTMENTS;
const storageKeys = window.AMICUS_STORAGE;

const DEPARTMENT_IMAGES = {
  preschool: { src: "assets/department-preschool-2026.png", alt: "나무 블록을 쌓는 유아-유치부의 손" },
  elementaryJr: { src: "assets/department-kids-2026.png", alt: "크레용과 그림책이 놓인 유년부의 책상" },
  elementary: { src: "assets/department-elementary-2026.png", alt: "노트와 연필이 놓인 초등부의 책상" },
  youth: { src: "assets/department-youth-2026.png", alt: "지도와 가죽 노트가 놓인 중고등부의 책상" }
};

function readApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.applications) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function readAssignment() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
  } catch {
    return null;
  }
}

// Students with no partner yet — the same figure partner.html gates on.
let serverAvailability = null;

function waitingByDepartment() {
  if (serverAvailability) {
    return Object.fromEntries(
      Object.keys(directory).map((key) => [key, serverAvailability.departments?.[key] ?? 0])
    );
  }
  const assigned = new Set(readApplications().map((application) => application.studentId));
  return Object.fromEntries(
    Object.entries(directory).map(([key, department]) => [
      key,
      department.students.filter((student) => !assigned.has(student.id)).length
    ])
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

// Four cards of one shape: the department name leads, the grade range supports.
function departmentCard(key, department, waiting) {
  const image = DEPARTMENT_IMAGES[key];
  const staffCount = window.AMICUS_DIRECTORY[key].staff.length;
  return `
    <a class="department-card" href="department.html?dept=${key}">
      <span class="department-card-photo">
        <img src="${image.src}" alt="${escapeHtml(image.alt)}" loading="lazy">
      </span>
      <span class="department-card-body">
        <span class="department-card-name">${escapeHtml(department.name)}</span>
        <span class="department-card-range">${escapeHtml(department.range)}<span class="department-card-latin">${escapeHtml(department.english)}</span></span>
        <span class="department-card-counts">
          <span>학생 <b>${department.students.length}</b></span>
          <span>간사 <b>${staffCount}</b></span>
        </span>
        ${waiting > 0 ? `<span class="department-card-waiting">${waiting}명 대기</span>` : ""}
        <span class="department-card-link">${escapeHtml(department.name)} 보기 →</span>
      </span>
    </a>`;
}

function render() {
  const waiting = waitingByDepartment();
  const total = Object.values(waiting).reduce((sum, count) => sum + count, 0);

  document.querySelector("#departmentGrid").innerHTML = Object.entries(directory)
    .map(([key, department]) => departmentCard(key, department, waiting[key]))
    .join("");

  document.querySelector("#homeWaitingTotal").textContent = String(total);

  const pill = document.querySelector("#waitingPill");
  pill.hidden = total === 0;
  pill.textContent = `파트너 대기 ${total}명`;

  // A partner returning mid-semester wants their student, not the form.
  const assignment = readAssignment();
  document.querySelector("#myPrayerLink").hidden = !assignment;
  document.querySelector("#applyLink").classList.toggle("is-only-action", !assignment);
}

render();

window.AMICUS_AVAILABILITY?.then((availability) => {
  if (availability && availability.departments) {
    serverAvailability = availability;
    render();
  }
});
