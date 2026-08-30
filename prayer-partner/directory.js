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

let currentRole = "student";
let loadingTimer;

function initials(name) {
  const primaryName = name.split(" (")[0].trim();
  return [...primaryName].slice(-2).join("");
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

function cardMarkup(person, index) {
  const roleLabel = currentRole === "student" ? "학생" : "간사";
  const cardClass = currentRole === "student" ? "person-card prayer-hand-card" : "person-card staff-person-card";
  return `
    <button class="${cardClass}" type="button" data-person-index="${index}">
      <span class="person-top">
        ${avatarMarkup(person, "avatar")}
        <span class="person-role">${roleLabel}</span>
      </span>
      <span>
        <h3>${person.name}</h3>
        <p class="person-meta">${person.school} / ${person.grade}</p>
      </span>
      <span class="prayer-preview">
        <span>기도제목</span>
        <p>${person.prayer}</p>
      </span>
      <span class="card-action">기도제목 크게 보기</span>
    </button>`;
}

function servingPersonMarkup(person) {
  return `
    <article class="serving-person">
      ${avatarMarkup(person, "serving-avatar")}
      <div>
        <div class="serving-person-heading">
          <h4>${person.name}</h4>
          <span>${person.grade}</span>
        </div>
        <p class="serving-team-name">${person.school}</p>
        <p class="serving-person-bio">${person.bio}</p>
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

    grid.innerHTML = filtered.map(cardMarkup).join("");
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

function openPerson(person) {
  const roleLabel = currentRole === "student" ? "학생" : "간사";
  personDialog.dataset.role = currentRole;
  const dialogAvatar = document.querySelector("#dialogAvatar");
  dialogAvatar.classList.toggle("staff-avatar-photo", Boolean(person.photo));
  dialogAvatar.textContent = person.photo ? "" : initials(person.name);
  dialogAvatar.style.setProperty("--staff-photo", person.photo ? `url('${person.photo}')` : "none");
  dialogAvatar.style.setProperty("--staff-photo-position", person.photoPosition || "center");
  document.querySelector("#dialogRole").textContent = `${department.name} ${roleLabel}`;
  document.querySelector("#dialogName").textContent = person.name;
  document.querySelector("#dialogMeta").textContent = `${person.school} / ${person.grade}`;
  document.querySelector("#dialogPrayer").textContent = person.prayer;
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
personDialog.addEventListener("click", (event) => {
  if (event.target === personDialog) personDialog.close();
});

applyDepartment();
window.setTimeout(renderPeople, 320);
