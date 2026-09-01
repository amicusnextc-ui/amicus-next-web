const directory = window.AMICUS_MATCHING_DEPARTMENTS;
const storageKeys = window.AMICUS_STORAGE;
const eventDetails = window.AMICUS_EVENT;
const partnerForm = document.querySelector("#partnerForm");
const applicationView = document.querySelector("#applicationView");
const emailVerificationView = document.querySelector("#emailVerificationView");
const matchingView = document.querySelector("#matchingView");
const resultView = document.querySelector("#resultView");
const submitPartner = document.querySelector("#submitPartner");
const verificationForm = document.querySelector("#verificationForm");
const verificationCode = document.querySelector("#verificationCode");
const verifyEmail = document.querySelector("#verifyEmail");

const applyBack = document.querySelector("#applyBack");
const applyHint = document.querySelector("#applyHint");
const applyStepLabel = document.querySelector("#applyStepLabel");
const applyBars = Array.from(document.querySelectorAll(".apply-bars li"));
const applySteps = Array.from(document.querySelectorAll(".apply-step"));
const waitingList = document.querySelector("#waitingList");
const waitingTotal = document.querySelector("#waitingTotal");

const TOTAL_STEPS = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stepCopy = {
  1: {
    title: "기도 파트너가 되어 주세요.",
    lede: "매주 학생의 이름을 불러 기도하고, 기도제목은 외부에 공유하지 않기로 약속해 주세요."
  },
  2: {
    title: "어느 부서의 학생과 함께하시겠어요?",
    lede: "특별히 마음에 있는 부서가 없다면 전체 부서를 선택해 주세요. 가장 필요한 학생과 연결됩니다."
  },
  3: {
    title: "마지막으로 약속을 확인해 주세요.",
    lede: "아래 내용이 맞는지 확인하고 기도 약속에 동의해 주세요."
  }
};

const rhythmLabels = {
  daily: "매일 짧게라도 기도하겠습니다.",
  "three-times": "주 3회 기도하겠습니다.",
  weekly: "매주 한 번 이름을 불러 기도하겠습니다."
};

let pendingVerification = null;
let currentStep = 1;
let matchingClosed = false;
let serverAvailability = null;

const availabilityElements = {
  any: document.querySelector("#availabilityAny"),
  preschool: document.querySelector("#availabilityPreschool"),
  elementaryJr: document.querySelector("#availabilityElementaryJr"),
  elementary: document.querySelector("#availabilityElementary"),
  youth: document.querySelector("#availabilityYouth")
};

function readApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.applications) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeApplications(applications) {
  localStorage.setItem(storageKeys.applications, JSON.stringify(applications));
}

function initials(name) {
  const primaryName = name.split(" (")[0].trim();
  return [...primaryName].slice(-2).join("");
}

// data.js records unknown values as prose ("학교 정보 없음", "학년 정보 확인 필요").
// Those are notes to the editor, not something to show a partner.
function realValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/정보\s*(없음|확인\s*필요)/.test(text)) return "";
  if (text === "없음") return "";
  return text;
}

function schoolAndGrade(student) {
  return [realValue(student.school), realValue(student.grade)].filter(Boolean).join(" / ");
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function allEligibleStudents(preference) {
  const departmentKeys = preference === "any" ? Object.keys(directory) : [preference];
  return departmentKeys.flatMap((departmentKey) =>
    directory[departmentKey].students.map((student) => ({ student, departmentKey }))
  );
}

function assignedStudentIds(applications) {
  return new Set(applications.map((application) => application.studentId));
}

function availableStudents(preference, applications) {
  const assigned = assignedStudentIds(applications);
  return allEligibleStudents(preference).filter(({ student }) => !assigned.has(student.id));
}

function renderAvailability(applications) {
  // The shared record is authoritative when reachable; otherwise fall back to
  // what this browser knows about its own applications.
  const availableByDepartment = serverAvailability
    ? Object.fromEntries(
        Object.keys(directory).map((departmentKey) => [
          departmentKey,
          serverAvailability.departments?.[departmentKey] ?? 0
        ])
      )
    : Object.fromEntries(
        Object.keys(directory).map((departmentKey) => [
          departmentKey,
          availableStudents(departmentKey, applications).length
        ])
      );
  const totalAvailable = Object.values(availableByDepartment).reduce((sum, count) => sum + count, 0);
  const counts = { any: totalAvailable, ...availableByDepartment };

  Object.entries(counts).forEach(([value, count]) => {
    const input = partnerForm.querySelector(`input[name="departmentPreference"][value="${value}"]`);
    const label = input?.closest("label");
    if (!input || !label) return;
    const isFull = count === 0;
    input.disabled = isFull;
    label.dataset.full = isFull ? "true" : "false";
    availabilityElements[value].textContent = isFull ? "마감" : `${count}명 대기`;
  });

  const selected = partnerForm.querySelector('input[name="departmentPreference"]:checked');
  if (!selected || selected.disabled) {
    const nextAvailable = partnerForm.querySelector('input[name="departmentPreference"]:not(:disabled)');
    if (nextAvailable) nextAvailable.checked = true;
  }

  const summary = document.querySelector("#availabilitySummary");
  summary.textContent = totalAvailable === 0
    ? "이번 학기 모든 학생의 기도 파트너가 연결되었습니다."
    : "아직 기도 파트너를 기다리는 학생이 있습니다.";
  matchingClosed = totalAvailable === 0;

  waitingTotal.textContent = String(totalAvailable);
  waitingList.replaceChildren(
    ...Object.entries(directory).map(([departmentKey, department]) => {
      const count = availableByDepartment[departmentKey];
      const row = document.createElement("li");
      const label = document.createElement("span");
      const value = document.createElement("b");
      row.dataset.full = count === 0 ? "true" : "false";
      label.textContent = department.name;
      value.textContent = count === 0 ? "마감" : `${count}명`;
      row.append(label, value);
      return row;
    })
  );

  renderWizard();
}

function departmentLabel(preference) {
  if (!preference) return "—";
  return preference === "any" ? "전체 부서" : directory[preference]?.name || "—";
}

function currentValues() {
  const data = new FormData(partnerForm);
  return {
    eventCode: String(data.get("eventCode") || "").trim().toUpperCase(),
    name: String(data.get("partnerName") || "").trim(),
    email: String(data.get("partnerEmail") || "").trim(),
    departmentPreference: String(data.get("departmentPreference") || ""),
    prayerRhythm: String(data.get("prayerRhythm") || ""),
    consent: data.get("privacyConsent") === "on"
  };
}

function stepHint(step, values) {
  if (step === 1) {
    if (values.name.length < 2) return "이름을 입력해 주세요.";
    if (!EMAIL_PATTERN.test(values.email)) return "기도카드를 받을 이메일이 필요합니다.";
    if (values.eventCode !== eventDetails.applicationCode) return "안내판에 적힌 신청코드를 입력해 주세요.";
    return "";
  }
  if (step === 2) {
    if (!values.departmentPreference) return "희망 부서를 선택해 주세요.";
    if (!values.prayerRhythm) return "기도 약속을 선택해 주세요.";
    return "";
  }
  return values.consent ? "" : "기도 약속에 동의해야 신청이 완료됩니다.";
}

function validateStep(step, values) {
  if (step === 1) {
    const errors = [
      fieldError("partnerName", values.name.length < 2 ? "이름을 두 글자 이상 입력해 주세요." : ""),
      fieldError("partnerEmail", !EMAIL_PATTERN.test(values.email) ? "올바른 이메일을 입력해 주세요." : ""),
      fieldError("eventCode", values.eventCode !== eventDetails.applicationCode ? "안내판에 적힌 신청코드를 확인해 주세요." : "")
    ];
    return !errors.some(Boolean);
  }
  if (step === 2) {
    const rhythmError = fieldError("prayerRhythm", !values.prayerRhythm ? "기도 약속을 선택해 주세요." : "");
    return Boolean(values.departmentPreference) && !rhythmError;
  }
  return !fieldError("privacyConsent", !values.consent ? "개인정보 보호 약속에 동의해 주세요." : "");
}

function renderWizard() {
  const values = currentValues();
  const hint = stepHint(currentStep, values);

  applySteps.forEach((section) => {
    section.hidden = Number(section.dataset.step) !== currentStep;
  });
  applyBars.forEach((bar) => {
    bar.dataset.on = Number(bar.dataset.bar) <= currentStep ? "true" : "false";
  });

  applyStepLabel.textContent = `${currentStep} / ${TOTAL_STEPS} 단계`;
  document.querySelector("#applicationTitle").textContent = stepCopy[currentStep].title;
  document.querySelector("#applicationLede").textContent = stepCopy[currentStep].lede;

  document.querySelector("#summaryName").textContent = values.name || "—";
  document.querySelector("#summaryEmail").textContent = values.email || "—";
  document.querySelector("#summaryDepartment").textContent = departmentLabel(values.departmentPreference);
  document.querySelector("#summaryRhythm").textContent = rhythmLabels[values.prayerRhythm] || "—";

  applyBack.hidden = currentStep === 1;
  submitPartner.disabled = matchingClosed;
  submitPartner.textContent = matchingClosed
    ? "이번 학기 매칭 마감"
    : (currentStep === TOTAL_STEPS ? "신청하고 학생 만나기" : "다음");
  submitPartner.dataset.blocked = !matchingClosed && hint ? "true" : "false";
  applyHint.textContent = matchingClosed ? "" : hint;
}

function focusStep() {
  const step = partnerForm.querySelector(`.apply-step[data-step="${currentStep}"]`);
  if (!step) return;
  const target = step.querySelector("input:checked") || step.querySelector("input");
  target?.focus();
}

function focusInvalid(field) {
  if (!field) return;
  if (field.id === "prayerRhythm") {
    field.querySelector("input")?.focus();
    return;
  }
  field.focus();
}

function goToStep(step) {
  currentStep = Math.min(TOTAL_STEPS, Math.max(1, step));
  document.querySelector("#formAlert").hidden = true;
  renderWizard();
}

function findStudent(studentId, departmentKey) {
  const department = directory[departmentKey];
  const student = department?.students.find((person) => person.id === studentId);
  return student ? { student, departmentKey } : null;
}

function pickupCodeFor(studentId, departmentKey) {
  const department = directory[departmentKey];
  const studentIndex = department?.students.findIndex((student) => student.id === studentId) ?? -1;
  const departmentLabel = department?.code || "기도";
  return `${departmentLabel}-${String(Math.max(studentIndex, 0) + 1).padStart(2, "0")}`;
}

function matchStudent(partner, applications) {
  const existing = applications.find((application) => application.email === partner.email);
  if (existing) {
    const existingMatch = findStudent(existing.studentId, existing.departmentKey);
    if (existingMatch) return { ...existingMatch, existingApplication: existing };
  }

  const eligible = availableStudents(partner.departmentPreference, applications);
  if (eligible.length === 0) return null;
  const chosenIndex = stableHash(`${partner.email}:${partner.name}`) % eligible.length;
  return eligible[chosenIndex];
}

function fieldError(id, message) {
  const error = document.querySelector(`#${id}Error`);
  error.textContent = message;
  const field = document.querySelector(`#${id}`);
  field?.setAttribute("aria-invalid", message ? "true" : "false");
  return Boolean(message);
}

function validateForm(formData) {
  const eventCode = String(formData.get("eventCode") || "").trim().toUpperCase();
  const name = String(formData.get("partnerName") || "").trim();
  const email = String(formData.get("partnerEmail") || "").trim().toLocaleLowerCase();
  const rhythm = String(formData.get("prayerRhythm") || "");
  const consent = formData.get("privacyConsent") === "on";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const errors = [
    fieldError("eventCode", eventCode !== eventDetails.applicationCode ? "안내판에 적힌 신청코드를 확인해 주세요." : ""),
    fieldError("partnerName", name.length < 2 ? "이름을 두 글자 이상 입력해 주세요." : ""),
    fieldError("partnerEmail", !emailPattern.test(email) ? "올바른 이메일을 입력해 주세요." : ""),
    fieldError("prayerRhythm", !rhythm ? "기도 약속을 선택해 주세요." : ""),
    fieldError("privacyConsent", !consent ? "개인정보 보호 약속에 동의해 주세요." : "")
  ];

  return {
    valid: !errors.some(Boolean),
    partner: {
      eventCode,
      name,
      email,
      departmentPreference: String(formData.get("departmentPreference") || "any"),
      prayerRhythm: rhythm
    }
  };
}

function saveAssignment(partner, match, applications) {
  if (match.existingApplication) {
    localStorage.setItem(storageKeys.currentAssignment, JSON.stringify(match.existingApplication));
    return match.existingApplication;
  }

  const application = {
    id: `partner-${Date.now()}-${stableHash(partner.email).toString(16)}`,
    name: partner.name,
    email: partner.email,
    departmentPreference: partner.departmentPreference,
    prayerRhythm: partner.prayerRhythm,
    eventCode: partner.eventCode,
    studentId: match.student.id,
    departmentKey: match.departmentKey,
    createdAt: new Date().toISOString()
  };

  applications.push(application);
  writeApplications(applications);
  localStorage.setItem(storageKeys.currentAssignment, JSON.stringify(application));
  return application;
}

function replaceStoredAssignment(application) {
  const applications = readApplications();
  const existingIndex = applications.findIndex((item) => item.id === application.id || item.email === application.email);
  if (existingIndex >= 0) applications.splice(existingIndex, 1, application);
  else applications.push(application);
  writeApplications(applications);
  localStorage.setItem(storageKeys.currentAssignment, JSON.stringify(application));
  return application;
}

function writePendingVerification(value) {
  pendingVerification = value;
  if (value) localStorage.setItem(storageKeys.emailVerification, JSON.stringify(value));
  else localStorage.removeItem(storageKeys.emailVerification);
}

function applicationDraft(partner, applicationId) {
  return {
    applicationId: applicationId || `partner-${Date.now()}-${stableHash(partner.email).toString(16)}`,
    partnerName: partner.name,
    email: partner.email,
    departmentPreference: partner.departmentPreference,
    prayerRhythm: partner.prayerRhythm,
    eventCode: partner.eventCode
  };
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "요청을 완료하지 못했습니다.");
    error.code = data.code || "request_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

function verificationErrorMessage(error) {
  const messages = {
    email_not_configured: "이메일 발송 설정이 아직 완료되지 않았습니다.",
    verification_rate_limited: "인증코드를 방금 보냈습니다. 잠시 후 다시 시도해 주세요.",
    verification_delivery_failed: "인증코드 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    invalid_verification: "인증코드가 맞지 않거나 유효시간이 지났습니다.",
    verification_attempts_exceeded: "인증 시도 횟수를 초과했습니다. 새 인증코드를 받아 주세요.",
    pdf_delivery_failed: "PDF 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."
  };
  return messages[error.code] || error.message || "이메일 요청을 완료하지 못했습니다.";
}

function showVerificationView(pending) {
  applicationView.hidden = true;
  matchingView.hidden = true;
  resultView.hidden = true;
  emailVerificationView.hidden = false;
  document.querySelector("#verificationEmailMessage").textContent = `${pending.email}로 인증코드를 보냈습니다. 이메일을 확인해 주세요.`;
  document.querySelector("#verificationError").textContent = "";
  verificationCode.value = "";
  verificationCode.removeAttribute("aria-invalid");
  window.scrollTo({ top: 0, behavior: "instant" });
  verificationCode.focus({ preventScroll: true });
}

function showMatchingScreen() {
  applicationView.hidden = true;
  emailVerificationView.hidden = true;
  resultView.hidden = true;
  matchingView.hidden = false;
  matchingView.setAttribute("aria-busy", "true");
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function requestEmailVerification(partner, applicationId) {
  const draft = applicationDraft(partner, applicationId);
  const response = await fetch("/api/request-email-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft)
  });
  const data = await responseData(response);
  const pending = {
    ...draft,
    verificationToken: data.verificationToken,
    expiresAt: data.expiresAt
  };
  writePendingVerification(pending);
  showVerificationView(pending);
}

function showLocalFallback(partner) {
  const applications = readApplications();
  const match = matchStudent(partner, applications);
  if (!match) throw new Error("선택한 부서의 모든 학생이 연결되었습니다.");
  const application = saveAssignment(partner, match, applications);
  application.emailDeliveryStatus = "not_configured";
  replaceStoredAssignment(application);
  showMatchingThenResult(application);
}

function applyResultTheme(departmentKey) {
  document.body.dataset.matchedDepartment = departmentKey;
}

function renderEmailDelivery(application) {
  const panel = document.querySelector("#resultEmailDelivery");
  const title = document.querySelector("#resultEmailTitle");
  const detail = document.querySelector("#resultEmailDetail");

  if (application.emailSentAt) {
    panel.dataset.state = "sent";
    title.textContent = "PDF 기도카드를 이메일로 보냈습니다.";
    detail.textContent = `${application.email}의 받은편지함과 스팸함을 확인해 주세요.`;
    return;
  }

  panel.dataset.state = "pending";
  if (application.emailDeliveryStatus === "not_configured") {
    title.textContent = "이메일 발송 설정이 아직 완료되지 않았습니다.";
    detail.textContent = "매칭 결과는 저장되었습니다. 지금은 아래 버튼으로 PDF를 직접 저장할 수 있습니다.";
  } else {
    title.textContent = "이 기도카드는 아직 이메일로 발송되지 않았습니다.";
    detail.textContent = "신청 정보를 다시 입력하면 이메일 인증과 PDF 발송을 진행할 수 있습니다.";
  }
}

function renderResult(application, announce = false) {
  const match = findStudent(application.studentId, application.departmentKey);
  if (!match) return;
  const { student, departmentKey } = match;
  const department = directory[departmentKey];
  const pickupCode = pickupCodeFor(student.id, departmentKey);

  applyResultTheme(departmentKey);
  document.querySelector("#resultPartnerName").textContent = `${application.name}님, 이번 학기 매칭이 완료되었습니다.`;
  document.querySelector("#resultStudentName").textContent = student.name;
  document.querySelector("#resultDepartment").textContent = `${department.name} / ${pickupCode}`;
  document.querySelector("#resultAvatar").textContent = initials(student.name);
  document.querySelector("#resultCardName").textContent = student.name;
  const schoolLine = schoolAndGrade(student);
  document.querySelector("#resultSchoolGrade").textContent = schoolLine;
  document.querySelector("#resultSchoolField").hidden = !schoolLine;
  document.querySelector("#resultPrayer").textContent =
    realValue(student.prayer) || "이번 학기 기도제목은 곧 등록될 예정입니다. 그때까지 이름을 불러 기도해 주세요.";
  document.querySelector("#resultPickupCode").textContent = pickupCode;
  renderEmailDelivery(application);

  applicationView.hidden = true;
  emailVerificationView.hidden = true;
  matchingView.hidden = true;
  resultView.hidden = false;
  matchingView.setAttribute("aria-busy", "false");
  if (announce) document.querySelector("#resultTitle").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showMatchingThenResult(application) {
  showMatchingScreen();
  window.setTimeout(() => renderResult(application, true), 1350);
}

partnerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formAlert = document.querySelector("#formAlert");
  formAlert.hidden = true;
  if (matchingClosed) return;

  if (currentStep < TOTAL_STEPS) {
    if (validateStep(currentStep, currentValues())) {
      goToStep(currentStep + 1);
      focusStep();
    } else {
      renderWizard();
      focusInvalid(partnerForm.querySelector(`.apply-step[data-step="${currentStep}"] [aria-invalid="true"]`));
    }
    return;
  }

  const result = validateForm(new FormData(partnerForm));

  if (!result.valid) {
    const invalid = partnerForm.querySelector('[aria-invalid="true"]');
    const owningStep = Number(invalid?.closest(".apply-step")?.dataset.step || currentStep);
    if (owningStep !== currentStep) goToStep(owningStep);
    formAlert.textContent = "입력하지 않았거나 확인이 필요한 항목이 있습니다.";
    formAlert.hidden = false;
    focusInvalid(invalid);
    return;
  }

  submitPartner.disabled = true;
  submitPartner.textContent = "인증 이메일 보내는 중";
  try {
    await requestEmailVerification(result.partner);
  } catch (error) {
    if (error.code === "email_not_configured") {
      try {
        showLocalFallback(result.partner);
      } catch (fallbackError) {
        formAlert.textContent = fallbackError.message;
        formAlert.hidden = false;
      }
    } else {
      formAlert.textContent = verificationErrorMessage(error);
      formAlert.hidden = false;
    }
  } finally {
    renderAvailability(readApplications());
  }
});

verificationCode.addEventListener("input", () => {
  verificationCode.value = verificationCode.value.replace(/\D/g, "").slice(0, 6);
  verificationCode.removeAttribute("aria-invalid");
  document.querySelector("#verificationError").textContent = "";
});

verificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = verificationCode.value.trim();
  const errorElement = document.querySelector("#verificationError");
  if (!pendingVerification || !/^\d{6}$/.test(code)) {
    verificationCode.setAttribute("aria-invalid", "true");
    errorElement.textContent = "이메일에 적힌 6자리 인증코드를 입력해 주세요.";
    verificationCode.focus();
    return;
  }

  verifyEmail.disabled = true;
  verifyEmail.textContent = "확인하고 PDF 보내는 중";
  showMatchingScreen();
  try {
    const response = await fetch("/api/verify-send-prayer-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verificationToken: pendingVerification.verificationToken,
        verificationCode: code
      })
    });
    const data = await responseData(response);
    const application = replaceStoredAssignment(data.assignment);
    writePendingVerification(null);
    renderAvailability(readApplications());
    window.setTimeout(() => renderResult(application, true), 450);
  } catch (error) {
    matchingView.hidden = true;
    emailVerificationView.hidden = false;
    errorElement.textContent = verificationErrorMessage(error);
    verificationCode.setAttribute("aria-invalid", "true");
    verificationCode.focus({ preventScroll: true });
  } finally {
    verifyEmail.disabled = false;
    verifyEmail.textContent = "인증하고 PDF 받기";
  }
});

document.querySelector("#resendVerification").addEventListener("click", async (event) => {
  if (!pendingVerification) return;
  const button = event.currentTarget;
  const errorElement = document.querySelector("#verificationError");
  button.disabled = true;
  button.textContent = "인증코드 보내는 중";
  errorElement.textContent = "";
  try {
    await requestEmailVerification({
      name: pendingVerification.partnerName,
      email: pendingVerification.email,
      departmentPreference: pendingVerification.departmentPreference,
      prayerRhythm: pendingVerification.prayerRhythm,
      eventCode: pendingVerification.eventCode
    }, pendingVerification.applicationId);
  } catch (error) {
    errorElement.textContent = verificationErrorMessage(error);
  } finally {
    button.disabled = false;
    button.textContent = "인증코드 다시 받기";
  }
});

document.querySelector("#backToApplication").addEventListener("click", () => {
  if (pendingVerification) {
    document.querySelector("#eventCode").value = pendingVerification.eventCode || "";
    document.querySelector("#partnerName").value = pendingVerification.partnerName;
    document.querySelector("#partnerEmail").value = pendingVerification.email;
    const rhythmInput = partnerForm.querySelector(`input[name="prayerRhythm"][value="${pendingVerification.prayerRhythm}"]`);
    if (rhythmInput) rhythmInput.checked = true;
    const departmentInput = partnerForm.querySelector(`input[name="departmentPreference"][value="${pendingVerification.departmentPreference}"]`);
    if (departmentInput && !departmentInput.disabled) departmentInput.checked = true;
  }
  writePendingVerification(null);
  emailVerificationView.hidden = true;
  applicationView.hidden = false;
  goToStep(1);
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelector("#partnerEmail").focus();
});

function restorePendingVerification() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.emailVerification) || "null");
    if (!saved || saved.expiresAt <= Date.now() || !saved.verificationToken) {
      writePendingVerification(null);
      return false;
    }
    pendingVerification = saved;
    showVerificationView(saved);
    return true;
  } catch {
    writePendingVerification(null);
    return false;
  }
}

document.querySelector("#printPrayerCard").addEventListener("click", () => window.print());
// Releasing is device-local: it forgets the saved card so the applicant (or the
// next person on a shared phone) can apply again. The emailed PDF and the
// ministry's own record are untouched — the copy says so. The confirm panel is
// built here rather than in the markup so the whole feature ships in one file.
const releaseButton = document.querySelector("#showApplicationAgain");
releaseButton.textContent = "이 기기에서 연결 해제하기";

const releaseConfirm = document.createElement("div");
releaseConfirm.hidden = true;
releaseConfirm.style.cssText =
  "width:min(100%,460px);margin:14px auto 0;padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:#fffdf8;text-align:center";
releaseConfirm.innerHTML =
  '<p style="margin:0 0 14px;color:var(--muted);font-size:13px;line-height:1.6">' +
  '이 기기에 저장된 <strong id="releaseStudentName" style="color:var(--dark)"></strong> 학생 기도카드가 지워지고 신청 화면으로 돌아갑니다. ' +
  "이메일로 받은 PDF와 교회에 접수된 신청 기록은 그대로 남습니다.</p>" +
  '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">' +
  '<button type="button" id="confirmRelease" style="min-height:42px;padding:0 20px;border:0;border-radius:999px;background:var(--matched-accent,var(--rust));color:#fffdf8;font-size:13px;font-weight:900;cursor:pointer">연결 해제</button>' +
  '<button type="button" id="cancelRelease" style="min-height:42px;padding:0 20px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--dark);font-size:13px;font-weight:900;cursor:pointer">취소</button>' +
  "</div>";
releaseButton.insertAdjacentElement("afterend", releaseConfirm);

function showApplicationForm() {
  writePendingVerification(null);
  resultView.hidden = true;
  emailVerificationView.hidden = true;
  applicationView.hidden = false;
  delete document.body.dataset.matchedDepartment;
  goToStep(1);
  renderAvailability(readApplications());
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelector("#partnerName").focus();
}

function releaseSavedAssignment() {
  let released = null;
  try {
    released = JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
  } catch {
    // A corrupt value still needs clearing.
  }
  localStorage.removeItem(storageKeys.currentAssignment);
  if (released) {
    writeApplications(
      readApplications().filter((item) => item.id !== released.id && item.email !== released.email)
    );
  }
}

releaseButton.addEventListener("click", () => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
  } catch {
    saved = null;
  }
  // Nothing stored (or unreadable) — go straight back to the form.
  if (!saved) {
    showApplicationForm();
    return;
  }
  const student = directory[saved.departmentKey]?.students.find((person) => person.id === saved.studentId);
  releaseConfirm.querySelector("#releaseStudentName").textContent = student
    ? student.name.split(" (")[0]
    : "매칭된";
  releaseConfirm.hidden = false;
  releaseConfirm.querySelector("#confirmRelease").focus();
});

releaseConfirm.querySelector("#cancelRelease").addEventListener("click", () => {
  releaseConfirm.hidden = true;
  releaseButton.focus();
});

releaseConfirm.querySelector("#confirmRelease").addEventListener("click", () => {
  releaseSavedAssignment();
  releaseConfirm.hidden = true;
  showApplicationForm();
});

partnerForm.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id && document.querySelector(`#${target.id}Error`)) fieldError(target.id, "");
  renderWizard();
});

partnerForm.addEventListener("change", (event) => {
  if (event.target.name === "prayerRhythm") fieldError("prayerRhythm", "");
  if (event.target.id === "privacyConsent") fieldError("privacyConsent", "");
  renderWizard();
});

applyBack.addEventListener("click", () => {
  goToStep(currentStep - 1);
  focusStep();
});

function prepareEventCode() {
  const input = document.querySelector("#eventCode");
  const supplied = new URLSearchParams(window.location.search).get("code");
  if (supplied && supplied.trim().toUpperCase() === eventDetails.applicationCode) {
    input.value = eventDetails.applicationCode;
    input.dataset.autofilled = "true";
  }

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12);
    input.removeAttribute("aria-invalid");
    document.querySelector("#eventCodeError").textContent = "";
  });
}

prepareEventCode();
renderAvailability(readApplications());

window.AMICUS_AVAILABILITY?.then((availability) => {
  if (availability && availability.departments) {
    serverAvailability = availability;
    renderAvailability(readApplications());
  }
});

if (!restorePendingVerification()) {
  try {
    const savedAssignment = JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
    if (savedAssignment) renderResult(savedAssignment);
  } catch {
    localStorage.removeItem(storageKeys.currentAssignment);
  }
}
