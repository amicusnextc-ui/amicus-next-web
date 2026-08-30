const directory = window.AMICUS_MATCHING_DEPARTMENTS;
const storageKeys = window.AMICUS_STORAGE;
const qrTargetInput = document.querySelector("#qrTarget");
const qrCodeElement = document.querySelector("#qrCode");
let qrCode;

function defaultPartnerUrl() {
  return "https://amicus-prayer-partner.vercel.app/partner.html";
}

function readApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.applications) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function studentFor(application) {
  return directory[application.departmentKey]?.students.find((student) => student.id === application.studentId);
}

function pickupCodeFor(application) {
  const department = directory[application.departmentKey];
  const studentIndex = department?.students.findIndex((student) => student.id === application.studentId) ?? -1;
  const departmentLabel = department?.code || "기도";
  return `${departmentLabel}-${String(Math.max(studentIndex, 0) + 1).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generateQrCode() {
  const target = qrTargetInput.value.trim();
  const error = document.querySelector("#qrTargetError");
  try {
    const url = new URL(target);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("protocol");
    error.textContent = "";
    qrTargetInput.setAttribute("aria-invalid", "false");
    localStorage.setItem(storageKeys.qrTarget, target);
    qrCodeElement.innerHTML = "";
    qrCode = new QRCode(qrCodeElement, {
      text: target,
      width: 236,
      height: 236,
      colorDark: "#2b2118",
      colorLight: "#fffdf8",
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch {
    error.textContent = "http 또는 https로 시작하는 올바른 주소를 입력해 주세요.";
    qrTargetInput.setAttribute("aria-invalid", "true");
    qrTargetInput.focus();
  }
}

function downloadQrCode() {
  const canvas = qrCodeElement.querySelector("canvas");
  const image = qrCodeElement.querySelector("img");
  const source = canvas?.toDataURL("image/png") || image?.src;
  if (!source) return;
  const link = document.createElement("a");
  link.download = "amicus-next-partner-qr.png";
  link.href = source;
  link.click();
}

function safeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportApplications() {
  const applications = readApplications();
  const rhythmLabels = {
    weekly: "매주 한 번",
    "three-times": "주 3회",
    daily: "매일"
  };
  const rows = [
    ["신청일", "파트너 이름", "이메일", "기도 약속", "매칭 부서", "수령번호", "학생 이름"],
    ...applications.map((application) => {
      const student = studentFor(application);
      return [
        new Date(application.createdAt).toLocaleString("ko-KR"),
        application.name,
        application.email,
        rhythmLabels[application.prayerRhythm] || application.prayerRhythm,
        directory[application.departmentKey]?.name || "",
        pickupCodeFor(application),
        student?.name || ""
      ];
    })
  ];
  const csv = `\ufeff${rows.map((row) => row.map(safeCsvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "amicus-partner-applications.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderApplications() {
  const applications = readApplications();
  const counts = { preschool: 0, elementaryJr: 0, elementary: 0, youth: 0 };
  applications.forEach((application) => {
    if (Object.hasOwn(counts, application.departmentKey)) counts[application.departmentKey] += 1;
  });

  document.querySelector("#totalApplications").textContent = applications.length;
  document.querySelector("#preschoolApplications").textContent = counts.preschool;
  document.querySelector("#elementaryJrApplications").textContent = counts.elementaryJr;
  document.querySelector("#elementaryApplications").textContent = counts.elementary;
  document.querySelector("#youthApplications").textContent = counts.youth;

  const recentList = document.querySelector("#recentList");
  const empty = document.querySelector("#adminEmpty");
  const recent = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  recentList.hidden = recent.length === 0;
  empty.hidden = recent.length !== 0;
  recentList.innerHTML = recent.map((application) => {
    const student = studentFor(application);
    const departmentName = directory[application.departmentKey]?.name || "부서 미지정";
    return `
      <article class="recent-item">
        <div class="recent-person">
          <strong>${escapeHtml(application.name)}</strong>
          <span>${escapeHtml(application.email)}</span>
        </div>
        <div class="recent-match">
          <span>${escapeHtml(departmentName)}</span>
          <strong>${escapeHtml(student?.name || "학생 정보 없음")} / ${escapeHtml(pickupCodeFor(application))}</strong>
        </div>
        <time datetime="${escapeHtml(application.createdAt)}">${escapeHtml(new Date(application.createdAt).toLocaleDateString("ko-KR"))}</time>
      </article>`;
  }).join("");
}

qrTargetInput.value = localStorage.getItem(storageKeys.qrTarget) || defaultPartnerUrl();
document.querySelector("#generateQr").addEventListener("click", generateQrCode);
document.querySelector("#downloadQr").addEventListener("click", downloadQrCode);
document.querySelector("#exportApplications").addEventListener("click", exportApplications);
generateQrCode();
renderApplications();
