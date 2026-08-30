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

let currentRole = "student";
let loadingTimer;
let openPersonId = null;

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

// Four buckets, oldest first; index 3 is the current week.
function weeklyCounts(dates) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const buckets = [0, 0, 0, 0];
  dates.forEach((date) => {
    const age = startOfToday.getTime() - new Date(`${date}T00:00:00`).getTime();
    const weeksAgo = Math.floor(age / WEEK_MS);
    if (weeksAgo >= 0 && weeksAgo < 4) buckets[3 - weeksAgo] += 1;
  });
  return buckets;
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

    const counts = partnerCounts();
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
  const counts = weeklyCounts(dates);
  const peak = Math.max(1, ...counts);
  const bars = [...document.querySelectorAll("#dialogRecordBars i")];

  bars.forEach((bar, index) => {
    bar.style.height = `${Math.max(8, Math.round((counts[index] / peak) * 100))}%`;
    bar.parentElement.dataset.current = index === 3 ? "true" : "false";
  });

  const thisWeek = counts[3];
  const prayedToday = dates.includes(today());
  document.querySelector("#dialogRecordCount").textContent = `이번 주 ${thisWeek}회`;
  const button = document.querySelector("#dialogPray");
  button.textContent = prayedToday ? "오늘 기도했습니다 ✓" : "오늘 기도 기록하기";
  button.dataset.prayed = prayedToday ? "true" : "false";
}

function togglePrayedToday() {
  if (!openPersonId) return;
  const log = readPrayerLog();
  const dates = log[openPersonId] || [];
  const stamp = today();
  log[openPersonId] = dates.includes(stamp)
    ? dates.filter((date) => date !== stamp)
    : [...dates, stamp];
  writePrayerLog(log);
  renderPrayerRecord();
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
  scheduleRender();
});
personDialog.addEventListener("click", (event) => {
  if (event.target === personDialog) personDialog.close();
});

applyDepartment();
window.setTimeout(renderPeople, 320);
