const directoryData = window.AMICUS_DIRECTORY;

const params = new URLSearchParams(window.location.search);
const requestedDepartment = params.get("dept");
const departmentKey = Object.hasOwn(directoryData, requestedDepartment) ? requestedDepartment : "preschool";
const department = directoryData[departmentKey];

const page = document.body;
const grid = document.querySelector("#peopleGrid");
const searchInput = document.querySelector("#searchInput");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const resultCount = document.querySelector("#resultCount");
const clearSearch = document.querySelector("#clearSearch");
const emptyState = document.querySelector("#emptyState");
const errorState = document.querySelector("#errorState");
const personDialog = document.querySelector("#personDialog");

const storageKeys = window.AMICUS_STORAGE;
const PRAYER_LOG_KEY = "amicus-prayer-log-v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Semester weeks run Sunday to Saturday from the fall kickoff. Dates before
// this render as empty bars instead of pretending there was a "last month".
const SEMESTER_START = new Date("2026-08-30T00:00:00");

let currentRole = "student";
let loadingTimer;
let openPersonId = null;
let serverStudentCounts = null;
let prayerAggregationOn = false;
let namedRecordingOn = false;

// The verified application this browser holds, if any — written by
// partner.html after email verification. Lets the prayer button report
// "who prayed" instead of an anonymous tick.
function currentPartner() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
    if (stored && typeof stored === "object" && stored.name && stored.id) {
      return { name: String(stored.name).slice(0, 40), applicationId: String(stored.id) };
    }
  } catch {
    // Fall through to anonymous reporting.
  }
  return null;
}

function initials(name) {
  return [...koreanName(name)].slice(-2).join("");
}

// data.js records unknown values as prose ("학교 정보 없음", "학년 정보 확인 필요").
// Those are notes to the editor, not something to show a reader.
function realValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/정보\s*(없음|확인\s*필요)/.test(text)) return "";
  if (text === "없음") return "";
  return text;
}

function koreanName(name) {
  return String(name || "").split(" (")[0].trim();
}

function latinName(name) {
  const match = /\(([^)]+)\)/.exec(String(name || ""));
  return match ? match[1].trim() : "";
}

function personMeta(person) {
  return [realValue(person.school), realValue(person.grade)].filter(Boolean).join(" · ");
}

function readApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.applications) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

// How many partners have actually been matched to each student, from the same
// store partner.html writes to.
function partnerCounts() {
  return readApplications().reduce((counts, application) => {
    if (!application.studentId) return counts;
    counts[application.studentId] = (counts[application.studentId] || 0) + 1;
    return counts;
  }, {});
}

function readPrayerLog() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRAYER_LOG_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function writePrayerLog(log) {
  try {
    localStorage.setItem(PRAYER_LOG_KEY, JSON.stringify(log));
  } catch {
    // A full or blocked store only costs the record, not the page.
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Which semester week (0-based) a date falls in. Negative means before the
// semester started.
function semesterWeekOf(date) {
  return Math.floor((date.getTime() - SEMESTER_START.getTime()) / WEEK_MS);
}

// Four buckets, oldest first; index 3 is the current semester week. Bucket
// weeks that precede the semester are marked null so they render as blank.
function weeklyCounts(dates) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const currentWeek = Math.max(0, semesterWeekOf(startOfToday));
  const buckets = [0, 1, 2, 3].map((index) => (currentWeek - (3 - index) < 0 ? null : 0));
  dates.forEach((date) => {
    const week = semesterWeekOf(new Date(`${date}T00:00:00`));
    const index = 3 - (currentWeek - week);
    if (week >= 0 && index >= 0 && index <= 3 && buckets[index] !== null) buckets[index] += 1;
  });
  return { buckets, currentWeek };
}

function normalize(value) {
  return value.toLocaleLowerCase("ko-KR").replaceAll(" ", "");
}

function personMatches(person, query) {
  const haystack = normalize(`${person.name} ${person.school} ${person.grade}`);
  return haystack.includes(normalize(query));
}

function avatarMarkup(person, className) {
  if (person.photo) {
    return `<span class="${className} staff-avatar-photo" style="--staff-photo: url('${person.photo}'); --staff-photo-position: ${person.photoPosition};" aria-hidden="true"></span>`;
  }
  return `<span class="${className}" aria-hidden="true">${initials(person.name)}</span>`;
}

function badgeFor(person, counts) {
  if (currentRole === "staff") {
    return { text: `기도 파트너 ${counts[person.id] || 0}명`, waiting: false };
  }
  const count = counts[person.id] || 0;
  return count === 0
    ? { text: "아직 파트너가 없어요", waiting: true }
    : { text: `파트너 ${count}명`, waiting: false };
}

function cardMarkup(person, index, counts) {
  const cardClass = currentRole === "student" ? "person-card prayer-hand-card" : "person-card staff-person-card";
  const latin = latinName(person.name);
  const meta = personMeta(person) || department.name;
  const prayer = realValue(person.prayer);
  const badge = badgeFor(person, counts);
  return `
    <button class="${cardClass}${badge.waiting ? " is-waiting" : ""}" type="button" data-person-index="${index}">
      <span class="person-identity">
        <h3>${escapeHtml(koreanName(person.name))}</h3>
        ${latin ? `<span class="person-latin">${escapeHtml(latin)}</span>` : ""}
      </span>
      <span class="person-meta">${escapeHtml(meta)}</span>
      <span class="prayer-preview">
        <span>기도제목</span>
        <p${prayer ? "" : ' class="is-empty"'}>${prayer ? escapeHtml(prayer) : "이번 학기 기도제목이 아직 등록되지 않았습니다."}</p>
      </span>
      <span class="card-foot">
        <span class="person-badge${badge.waiting ? " is-waiting" : ""}">${badge.text}</span>
        <span class="card-action">전체 보기 →</span>
      </span>
    </button>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function servingPersonMarkup(person) {
  return `
    <article class="serving-person">
      ${avatarMarkup(person, "serving-avatar")}
      <div>
        <div class="serving-person-heading">
          <h4>${escapeHtml(koreanName(person.name))}</h4>
          ${realValue(person.grade) ? `<span>${escapeHtml(realValue(person.grade))}</span>` : ""}
        </div>
        ${realValue(person.school) ? `<p class="serving-team-name">${escapeHtml(realValue(person.school))}</p>` : ""}
        <p class="serving-person-bio">${escapeHtml(person.bio || "")}</p>
      </div>
    </article>`;
}

function departmentPrayerMarkup(point, index) {
  return `
    <li>
      <span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <p>${point}</p>
    </li>`;
}

function renderPeople() {
  try {
    const query = searchInput.value.trim();
    const people = department[currentRole === "student" ? "students" : "staff"];
    const filtered = people.filter((person) => personMatches(person, query));

    const counts = serverStudentCounts || partnerCounts();
    grid.innerHTML = filtered.map((person, index) => cardMarkup(person, index, counts)).join("");
    grid.hidden = filtered.length === 0;
    grid.setAttribute("aria-busy", "false");
    emptyState.hidden = filtered.length !== 0;
    errorState.hidden = true;
    clearSearch.hidden = query.length === 0;

    const label = currentRole === "student" ? "학생" : "간사";
    resultCount.textContent = `${label} ${filtered.length}명을 보여드리고 있습니다.`;

    [...grid.querySelectorAll(".person-card")].forEach((card) => {
      card.addEventListener("click", () => openPerson(filtered[Number(card.dataset.personIndex)]));
    });
  } catch (error) {
    grid.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = false;
    resultCount.textContent = "명단을 불러오지 못했습니다.";
    console.error(error);
  }
}

function scheduleRender() {
  window.clearTimeout(loadingTimer);
  grid.hidden = false;
  emptyState.hidden = true;
  errorState.hidden = true;
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton-card" aria-hidden="true"></div>').join("");
  loadingTimer = window.setTimeout(renderPeople, 180);
}

function setRole(role) {
  currentRole = role;
  filterButtons.forEach((button) => {
    const active = button.dataset.role === role;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  scheduleRender();
}

function clearQuery() {
  searchInput.value = "";
  searchInput.focus();
  scheduleRender();
}

function renderPrayerRecord() {
  const log = readPrayerLog();
  const dates = openPersonId ? log[openPersonId] || [] : [];
  const { buckets, currentWeek } = weeklyCounts(dates);
  const peak = Math.max(1, ...buckets.map((count) => count || 0));
  const bars = [...document.querySelectorAll("#dialogRecordBars i")];

  bars.forEach((bar, index) => {
    const count = buckets[index];
    bar.style.height = count === null ? "8%" : `${Math.max(8, Math.round((count / peak) * 100))}%`;
    bar.style.opacity = count === null ? "0.25" : "";
    bar.parentElement.dataset.current = index === 3 ? "true" : "false";
  });

  const label = document.querySelector(".dialog-record-label");
  if (label) label.textContent = `학기 ${currentWeek + 1}주차`;

  const thisWeek = buckets[3] || 0;
  const prayedToday = dates.includes(today());
  document.querySelector("#dialogRecordCount").textContent = `이번 주 ${thisWeek}회`;
  const button = document.querySelector("#dialogPray");
  button.textContent = prayedToday ? "오늘 기도했습니다 ✓" : "오늘 기도 기록하기";
  button.dataset.prayed = prayedToday ? "true" : "false";
  renderReminderCopy();
}

function reportPrayer(key, prayed) {
  const role = key.split(":")[1];
  const partner = currentPartner();
  fetch("/api/record-prayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      prayed,
      // Students are resolved server-side from the roster; only staff, who
      // exist solely in this page's data, send a display name.
      name: role === "staff" ? document.querySelector("#dialogName").textContent.trim() : "",
      // A verified partner on this device signs the record so the ministry
      // can see who is praying along; visitors stay anonymous.
      ...(partner ? { partner } : {})
    })
  }).then(async (response) => {
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    prayerAggregationOn = true;
    if (data.named) namedRecordingOn = true;
    renderReminderCopy();
  }).catch(() => {
    // Aggregation is a bonus; the local record above already succeeded.
  });
}

function renderReminderCopy() {
  const reminder = document.querySelector(".dialog-reminder");
  if (!reminder) return;
  const partner = currentPartner();
  if (partner && (namedRecordingOn || !prayerAggregationOn)) {
    reminder.textContent = `기도 기록은 이 기기에 저장되고, ${partner.name}님의 이름으로 교육부 기도 참여 기록에도 함께 남습니다. 화면 캡처와 외부 공유는 하지 말아 주세요.`;
    return;
  }
  reminder.textContent = prayerAggregationOn
    ? "기도 기록은 이 기기에 저장되며, 간사에게는 익명 횟수만 전달됩니다. 화면 캡처와 외부 공유는 하지 말아 주세요."
    : "기도 기록은 이 기기에만 저장됩니다. 화면 캡처와 외부 공유는 하지 말아 주세요.";
}

// A tap on the prayer button should feel like something happened. The toast is
// a child of the dialog because a modal's backdrop would otherwise cover it,
// and it is fixed-position so it floats rather than shifting the card.
let toastTimer;

function showPrayerToast(heading, detail) {
  let toast = document.querySelector("#prayerToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "prayerToast";
    toast.setAttribute("role", "status");
    toast.style.cssText = [
      "position:fixed", "left:50%", "bottom:26px",
      "transform:translateX(-50%) translateY(8px)",
      "max-width:min(340px,86vw)", "padding:14px 20px", "border-radius:14px",
      "background:#2b2118", "color:#fffdf8", "text-align:center",
      "box-shadow:0 12px 30px rgba(43,33,24,.28)", "pointer-events:none",
      "opacity:0", "z-index:20"
    ].join(";");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      toast.style.transition = "opacity .22s ease, transform .22s ease";
    }
    personDialog.append(toast);
  }

  toast.replaceChildren();
  const title = document.createElement("strong");
  title.style.cssText = "display:block;font-size:14px;font-weight:800;";
  title.textContent = heading;
  toast.append(title);
  if (detail) {
    const line = document.createElement("span");
    line.style.cssText = "display:block;margin-top:6px;font-size:13px;line-height:1.6;opacity:.82;";
    line.textContent = detail;
    toast.append(line);
  }

  window.requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(8px)";
  }, 3400);
}

function hidePrayerToast() {
  window.clearTimeout(toastTimer);
  const toast = document.querySelector("#prayerToast");
  if (toast) toast.style.opacity = "0";
}

function togglePrayedToday() {
  if (!openPersonId) return;
  const log = readPrayerLog();
  const dates = log[openPersonId] || [];
  const stamp = today();
  const prayedNow = !dates.includes(stamp);
  log[openPersonId] = prayedNow
    ? [...dates, stamp]
    : dates.filter((date) => date !== stamp);
  writePrayerLog(log);
  renderPrayerRecord();
  reportPrayer(openPersonId, prayedNow);

  if (!prayedNow) {
    showPrayerToast("오늘 기록을 취소했습니다");
    return;
  }
  const name = document.querySelector("#dialogName").textContent.trim();
  const honorific = currentRole === "student" ? "학생" : "간사님";
  const thisWeek = weeklyCounts(log[openPersonId]).buckets[3] || 0;
  showPrayerToast(
    "기도를 기록했습니다",
    `${name} ${honorific}을 위한 이번 주 ${thisWeek}번째 기도입니다.`
  );
}

function openPerson(person) {
  const roleLabel = currentRole === "student" ? "학생" : "간사";
  const meta = personMeta(person);
  const prayer = realValue(person.prayer);
  const note = realValue(person.note);

  openPersonId = `${departmentKey}:${currentRole}:${person.id}`;
  personDialog.dataset.role = currentRole;
  document.querySelector("#dialogRole").textContent = `${department.name} · ${roleLabel}`;
  document.querySelector("#dialogName").textContent = koreanName(person.name);
  document.querySelector("#dialogMeta").textContent = [latinName(person.name), meta].filter(Boolean).join(" · ");
  document.querySelector("#dialogPrayer").textContent = prayer || "이번 학기 기도제목이 아직 등록되지 않았습니다. 이름을 불러 기도해 주세요.";

  const notePanel = document.querySelector("#dialogNote");
  notePanel.hidden = !note;
  document.querySelector("#dialogNoteText").textContent = note;

  hidePrayerToast();
  renderPrayerRecord();
  personDialog.showModal();
}

function applyDepartment() {
  page.dataset.department = departmentKey;
  document.title = `${department.name} 기도 디렉터리 | AMICUS NEXT`;
  document.querySelector("#departmentEnglish").textContent = department.english;
  document.querySelector("#departmentName").textContent = department.name;
  document.querySelector("#departmentMessage").textContent = department.message;
  document.querySelector("#departmentImage").src = department.image;
  document.querySelector("#departmentImage").alt = department.imageAlt;
  document.querySelector("#studentCount").textContent = department.students.length;
  document.querySelector("#staffCount").textContent = department.staff.length;
  document.querySelector("#departmentIntroduction").textContent = department.introduction;
  document.querySelector("#servingTeamList").innerHTML = department.staff.map(servingPersonMarkup).join("");
  document.querySelector("#departmentPrayerList").innerHTML = department.prayerPoints.map(departmentPrayerMarkup).join("");
  document.querySelector(`[data-nav-dept="${departmentKey}"]`).setAttribute("aria-current", "page");
}

filterButtons.forEach((button) => button.addEventListener("click", () => setRole(button.dataset.role)));
searchInput.addEventListener("input", scheduleRender);
clearSearch.addEventListener("click", clearQuery);
document.querySelector("#emptyClear").addEventListener("click", clearQuery);
document.querySelector("#retryButton").addEventListener("click", scheduleRender);
document.querySelector("#dialogClose").addEventListener("click", () => personDialog.close());
document.querySelector("#dialogPray").addEventListener("click", togglePrayedToday);
personDialog.addEventListener("close", () => {
  openPersonId = null;
  hidePrayerToast();
  scheduleRender();
});
personDialog.addEventListener("click", (event) => {
  if (event.target === personDialog) personDialog.close();
});

// A partner arriving from the home page or a reminder email lands on their own
// student, not on a grid of twenty-five. ?student=<id> opens that card straight
// away; an unknown id just leaves the normal list showing.
function openRequestedStudent() {
  const requested = params.get("student");
  if (!requested) return;
  const student = department.students.find((person) => person.id === requested);
  if (!student) return;
  setRole("student");
  openPerson(student);
}

applyDepartment();
window.setTimeout(() => {
  renderPeople();
  openRequestedStudent();
}, 320);

window.AMICUS_AVAILABILITY?.then((availability) => {
  if (availability && availability.students) {
    serverStudentCounts = availability.students;
    scheduleRender();
  }
});
