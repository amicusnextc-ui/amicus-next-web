const eventDetails = window.AMICUS_EVENT;
const publicPartnerUrl = eventDetails.applicationUrl;
const partnerUrlInput = document.querySelector("#partnerUrl");
const posterQrElement = document.querySelector("#posterPrintQr");
const storageKeys = window.AMICUS_STORAGE;
let qrInstances = [];

function initialPartnerUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("target");
  return fromQuery || localStorage.getItem(storageKeys.qrTarget) || publicPartnerUrl;
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value;
  }
}

function updateQr() {
  const enteredTarget = partnerUrlInput.value.trim();
  const error = document.querySelector("#partnerUrlError");

  try {
    const url = new URL(enteredTarget);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
    url.searchParams.set("code", eventDetails.applicationCode);
    const target = url.toString();
    error.textContent = "";
    partnerUrlInput.setAttribute("aria-invalid", "false");
    partnerUrlInput.value = target;
    localStorage.setItem(storageKeys.qrTarget, target);
    qrInstances = [];
    posterQrElement.innerHTML = "";
    qrInstances.push(new QRCode(posterQrElement, {
      text: target,
      width: 220,
      height: 220,
      colorDark: "#284a36",
      colorLight: "#fffdf6",
      correctLevel: QRCode.CorrectLevel.H
    }));
    document.querySelectorAll(".bulletin-qr").forEach((element) => {
      element.innerHTML = "";
      qrInstances.push(new QRCode(element, {
        text: target,
        width: 80,
        height: 80,
        colorDark: "#294627",
        colorLight: "#fffdf6",
        correctLevel: QRCode.CorrectLevel.H
      }));
    });
    document.querySelector("#posterUrlLabel").textContent = shortUrl(target);
  } catch {
    error.textContent = "http 또는 https로 시작하는 신청 주소를 입력해 주세요.";
    partnerUrlInput.setAttribute("aria-invalid", "true");
    partnerUrlInput.focus();
  }
}

function populateWeeks() {
  const weekMarkup = Array.from({ length: 16 }, (_, index) => `<span>${index + 1}</span>`).join("");
  document.querySelectorAll(".week-grid").forEach((grid) => {
    grid.innerHTML = weekMarkup;
  });
}

function printArtifact(artifact) {
  document.body.dataset.printArtifact = artifact;
  window.print();
}

partnerUrlInput.value = initialPartnerUrl();
document.querySelector("#printEventCode").textContent = eventDetails.applicationCode;
document.querySelector("#posterEventCode").textContent = eventDetails.applicationCode;
document.querySelector("#updatePrintQr").addEventListener("click", updateQr);
document.querySelectorAll("[data-print]").forEach((button) => {
  button.addEventListener("click", () => printArtifact(button.dataset.print));
});
window.addEventListener("afterprint", () => delete document.body.dataset.printArtifact);
populateWeeks();
updateQr();
