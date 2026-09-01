const directory = window.AMICUS_DIRECTORY;
const storageKeys = window.AMICUS_STORAGE;
const PRAYER_LOG_KEY = "amicus-prayer-log-v1";

const params = new URLSearchParams(window.location.search);
const stepsList = document.querySelector("#guideSteps");
const recordButton = document.querySelector("#guideRecord");
const recordNote = document.querySelector("#guideRecordNote");

let currentLength = "full";

// ---------------------------------------------------------------------------
// The prayer itself.
//
// The shape follows the pastoral prayer prayed over the students at the start
// of the semester — name and lift up, the family's own request, learning and
// identity, the people around them and their safety, then blessing spoken over
// them. Steps 3 and 4 are the ones that change with age: what "learning" and
// "who they are with" mean to a four-year-old and a twelfth-grader share almost
// nothing, and a single paragraph covering both would be true of neither.
// ---------------------------------------------------------------------------

const SHARED_STEPS = {
  open: {
    minutes: 1,
    title: "이름을 부르며 올려드립니다",
    guide: "이름을 한 번 소리 내어 불러 보세요. 하나님께서 이 아이를 이름으로 아신다는 것이 이 기도의 시작입니다.",
    prayer: (name) => `사랑의 아버지 하나님, 오늘 ${name}${josa(name, "을", "를")} 주님의 손에 올려 드립니다. 어느 곳에 있든지 눈동자처럼 지켜 주시고, 오직 그리스도의 사랑 안에서 강건하게 자라게 하여 주옵소서.`,
    verse: "내가 너를 지명하여 불렀나니 너는 내 것이라",
    reference: "이사야 43:1"
  },
  topic: {
    minutes: 3,
    title: "이 아이의 기도제목으로",
    guide: "가정에서 직접 적어 보내신 기도제목입니다. 한 번 읽고, 한 구절씩 천천히 다시 기도해 주세요.",
    prayer: () => "이 기도를 적은 부모의 마음을 아시지요. 그 마음대로 이루어 주시고, 은혜 위에 은혜를 더하여 주옵소서.",
    verse: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로 너희 구할 것을 감사함으로 하나님께 아뢰라",
    reference: "빌립보서 4:6"
  },
  // Used in place of `topic` for the students whose family has not sent one in
  // yet. Praying for a child you barely know is the older thing, not the
  // lesser thing, and the copy says so rather than apologising.
  topicUnknown: {
    minutes: 3,
    title: "이름으로 기도합니다",
    guide: "이 학생의 기도제목은 곧 등록될 예정입니다. 그때까지는 아는 것으로 기도합니다 — 이름, 나이, 그리고 이 아이가 우리 교회의 아이라는 사실.",
    prayer: () => "제가 이 아이에 대해 아는 것이 많지 않습니다. 그러나 하나님은 다 아십니다. 제가 모르는 필요를 채워 주시고, 어느 곳에 있든지 주님의 사랑 안에 거하게 하여 주옵소서.",
    after: "잘 모르는 아이를 위해 기도하는 것은 부족한 기도가 아닙니다. 이름만 알고 드리는 기도가 가장 오래된 기도의 모습입니다.",
    verse: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로 너희 구할 것을 감사함으로 하나님께 아뢰라",
    reference: "빌립보서 4:6"
  },
  bless: {
    minutes: 2,
    title: "축복하며 마칩니다",
    guide: "마지막은 구하는 기도가 아니라 선포하는 기도입니다. 이름을 넣어 축복해 주세요.",
    prayer: (name) => `${name}${josa(name, "은", "는")} 하나님의 사랑받는 자녀입니다. 들어와도 복을 받고 나가도 복을 받을 것이며, 어디로 가든지 하나님께서 함께하실 것입니다. 학년이 올라가는 한 학기가 아니라 믿음이 자라고 꿈이 자라고 하나님을 더 깊이 알아가는 한 학기가 되게 하여 주옵소서. 예수 그리스도의 이름으로 기도드립니다. 아멘.`,
    verse: "네가 들어와도 복을 받고 나가도 복을 받을 것이니라 · 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라",
    reference: "신명기 28:6 · 여호수아 1:9"
  }
};

const LEARNING_VERSE = {
  verse: "여호와는 지혜를 주시며 지식과 명철을 그 입에서 내심이며",
  reference: "잠언 2:6"
};

const KEEPING_VERSE = {
  verse: "여호와께서 너의 출입을 지금부터 영원까지 지키시리로다",
  reference: "시편 121:8"
};

const BY_DEPARTMENT = {
  preschool: {
    learning: {
      guide: "아직 배움이 책상 앞에 있지 않은 나이입니다. 세상을 처음 만나는 중입니다.",
      prayer: "잘 자고 잘 먹게 하시고, 새로운 것을 두려워하지 않게 하여 주옵소서. 낯선 자리에서도 웃을 수 있는 마음을 주시고, 이 아이가 보고 듣는 모든 것에 주님의 선하심이 묻어나게 하여 주옵소서."
    },
    keeping: {
      guide: "이 아이가 오늘 실제로 있는 자리를 떠올려 보세요. 집, 어린이집, 그리고 엄마와 떨어져 있는 시간.",
      prayer: "좋은 선생님을 만나게 하여 주시고, 엄마와 떨어져 있는 시간에도 평안하게 하여 주옵소서. 다치지 않게 지켜 주시고, 아플 때 속히 낫게 하여 주옵소서."
    }
  },
  elementaryJr: {
    learning: {
      guide: "처음으로 규칙을 배우는 시기입니다. 앉아 있는 것 자체가 훈련입니다.",
      prayer: "글자와 숫자를 배우는 기쁨을 주시고, 못하는 것 앞에서 쉽게 주눅 들지 않게 하여 주옵소서. 잘하지 못해도 다시 해보는 마음을 주시고, 배움이 즐거운 일이라는 것을 이 아이가 먼저 알게 하여 주옵소서."
    },
    keeping: {
      guide: "이 아이가 오늘 실제로 있는 자리를 떠올려 보세요. 교실, 짝꿍, 그리고 오가는 길.",
      prayer: "첫 담임선생님과 짝꿍을 축복하여 주시고, 이 아이가 먼저 인사하는 아이가 되게 하여 주옵소서. 등교하는 길과 하교하는 길을 지켜 주시고, 보이는 위험과 보이지 않는 위험에서도 지켜 주옵소서."
    }
  },
  elementary: {
    learning: {
      guide: "비교가 시작되는 나이입니다. 스스로 잘하는 것과 못하는 것을 알기 시작합니다.",
      prayer: "성적보다 성실함을, 경쟁보다 사랑을, 성공보다 하나님을 기뻐하는 삶을 선택하게 하여 주옵소서. 남과 견주어 자신을 보지 않게 하시고, 세상의 기준이 아니라 하나님의 말씀으로 자신을 바라보게 하여 주옵소서."
    },
    keeping: {
      guide: "이 아이가 오늘 실제로 있는 자리를 떠올려 보세요. 무리가 생기고, 끼기도 하고 빠지기도 하는 나이입니다.",
      prayer: "좋은 친구를 만나게 하시고, 이 아이도 누군가의 좋은 친구가 되게 하여 주옵소서. 무리에서 밀려나는 아픔을 겪지 않게 하시고, 혹 외로운 친구가 있다면 먼저 다가가는 용기를 주옵소서. 화면 앞에 있는 시간에도 마음을 지켜 주옵소서."
    }
  },
  youth: {
    learning: {
      guide: "세상의 기준이 가장 세게 밀려오는 때입니다. 성적과 진로와 “나는 어떤 사람인가”가 한꺼번에 옵니다.",
      prayer: "공부할 때 지혜와 총명을 주시고, 결과가 곧 자기 자신이 아님을 알게 하여 주옵소서. 어디에 있든지 하나님의 사랑받는 자녀임을 잊지 않게 하시고, 진로를 정할 때 두려움이 아니라 부르심을 따라가게 하여 주옵소서."
    },
    keeping: {
      guide: "이 아이가 오늘 실제로 있는 자리를 떠올려 보세요. 곁에 있는 친구, 그리고 혼자인 시간.",
      prayer: "좋은 선생님과 좋은 친구를 만나게 하여 주시고, 어려움에 처한 친구가 있다면 따뜻한 손길로 먼저 잡아 주는 아이가 되게 하여 주옵소서. 혼자 견디는 시간이 있다면 그 자리에 주님이 계시게 하시고, 몸과 마음과 생각을 건강하게 보호하여 주옵소서."
    }
  }
};

// A guide opened with no student attached still has to be usable — someone may
// reach it from the poster before applying. "이 아이" stands in for the name.
const GENERIC_DEPARTMENT = "elementary";
const GENERIC_NAME = "이 아이";

// ---------------------------------------------------------------------------
// Who this guide is for
// ---------------------------------------------------------------------------

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

// Korean particles agree with the last syllable: a name closing on a consonant
// takes 은/을, one closing on a vowel takes 는/를. This page is meant to be read
// aloud, so "최예진은(는)" would trip the reader on the one sentence that matters
// most. Non-Hangul endings fall back to the paired form.
function josa(word, afterConsonant, afterVowel) {
  const last = String(word || "").trim().slice(-1);
  const code = last.charCodeAt(0);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return `${afterConsonant}(${afterVowel})`;
  return (code - 0xac00) % 28 === 0 ? afterVowel : afterConsonant;
}

function savedAssignment() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.currentAssignment) || "null");
    return stored && typeof stored === "object" ? stored : null;
  } catch {
    return null;
  }
}

// The URL wins over the device, so a link in the weekly reminder opens the
// right child even on a phone that never completed an application.
function resolveTarget() {
  const assignment = savedAssignment();
  const departmentKey = params.get("dept") || assignment?.departmentKey || "";
  const studentId = params.get("student") || assignment?.studentId || "";
  const department = directory[departmentKey];
  const student = department?.students.find((person) => person.id === studentId);
  if (!department || !student) return null;
  return { departmentKey, department, student, partner: assignment };
}

const target = resolveTarget();

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function stepsFor(target) {
  const departmentKey = target ? target.departmentKey : GENERIC_DEPARTMENT;
  const byAge = BY_DEPARTMENT[departmentKey] || BY_DEPARTMENT[GENERIC_DEPARTMENT];
  const topic = target ? realValue(target.student.prayer) : "";
  const name = target ? koreanName(target.student.name) : GENERIC_NAME;

  return [
    { ...SHARED_STEPS.open, key: "open", body: SHARED_STEPS.open.prayer(name), inShort: true },
    topic
      ? { ...SHARED_STEPS.topic, key: "topic", body: SHARED_STEPS.topic.prayer(), quote: topic, inShort: true }
      : { ...SHARED_STEPS.topicUnknown, key: "topic", body: SHARED_STEPS.topicUnknown.prayer(), inShort: true },
    {
      key: "learning",
      minutes: 2,
      title: "배움과 자라감을 위해",
      guide: byAge.learning.guide,
      body: byAge.learning.prayer,
      ...LEARNING_VERSE,
      inShort: false
    },
    {
      key: "keeping",
      minutes: 2,
      title: "만남과 지켜 주심을 위해",
      guide: byAge.keeping.guide,
      body: byAge.keeping.prayer,
      ...KEEPING_VERSE,
      inShort: false
    },
    { ...SHARED_STEPS.bless, key: "bless", body: SHARED_STEPS.bless.prayer(name), inShort: true }
  ];
}

function renderSteps() {
  const steps = stepsFor(target).filter((step) => currentLength === "full" || step.inShort);
  stepsList.replaceChildren();

  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "guide-step";

    const head = document.createElement("div");
    head.className = "guide-step-head";
    const number = document.createElement("span");
    number.className = "guide-step-number";
    number.textContent = String(index + 1);
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = step.title;
    const minutes = document.createElement("span");
    minutes.className = "guide-step-minutes";
    minutes.textContent = `${step.minutes}분`;
    heading.append(title, minutes);
    head.append(number, heading);

    const guide = document.createElement("p");
    guide.className = "guide-step-guide";
    guide.textContent = step.guide;

    item.append(head, guide);

    if (step.quote) {
      const quote = document.createElement("blockquote");
      quote.className = "guide-step-topic";
      quote.textContent = step.quote;
      item.append(quote);
    }

    const prayer = document.createElement("p");
    prayer.className = "guide-step-prayer";
    prayer.textContent = `“${step.body}”`;
    item.append(prayer);

    if (step.after) {
      const after = document.createElement("p");
      after.className = "guide-step-after";
      after.textContent = step.after;
      item.append(after);
    }

    const verse = document.createElement("p");
    verse.className = "guide-step-verse";
    const verseText = document.createElement("span");
    verseText.textContent = step.verse;
    const reference = document.createElement("cite");
    reference.textContent = step.reference;
    verse.append(verseText, reference);
    item.append(verse);

    stepsList.append(item);
  });
}

function renderHeader() {
  const title = document.querySelector("#guideTitle");
  const meta = document.querySelector("#guideMeta");
  const notice = document.querySelector("#guideNoStudent");
  const back = document.querySelector("#guideBack");

  if (!target) {
    notice.hidden = false;
    back.hidden = true;
    return;
  }

  const name = koreanName(target.student.name);
  title.textContent = `${name} 학생과 보내는 10분`;
  document.title = `${name} 학생과 보내는 10분 | AMICUS NEXT`;
  meta.hidden = false;
  meta.textContent = [target.department.name, realValue(target.student.grade)].filter(Boolean).join(" · ");
  back.href = `department.html?dept=${encodeURIComponent(target.departmentKey)}&student=${encodeURIComponent(target.student.id)}`;
}

// ---------------------------------------------------------------------------
// Recording, on the same store the department page writes to
// ---------------------------------------------------------------------------

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readPrayerLog() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRAYER_LOG_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function prayerKey() {
  return target ? `${target.departmentKey}:student:${target.student.id}` : "";
}

function prayedToday() {
  if (!target) return false;
  return (readPrayerLog()[prayerKey()] || []).includes(today());
}

function renderRecordState() {
  const closing = document.querySelector("#guideClose");
  if (!target) {
    closing.hidden = true;
    return;
  }
  const done = prayedToday();
  recordButton.textContent = done ? "오늘 기도했습니다 ✓" : "오늘 기도 기록하기";
  recordButton.dataset.prayed = done ? "true" : "false";
  recordButton.disabled = done;
  recordNote.textContent = done
    ? "오늘 기록이 저장되었습니다. 취소하려면 학생 카드에서 다시 눌러 주세요."
    : "기록은 이 기기에 저장되고, 신청을 마치신 분은 이름과 함께 교육부 기록에도 남습니다.";
}

function recordPrayer() {
  if (!target || prayedToday()) return;

  const log = readPrayerLog();
  const key = prayerKey();
  log[key] = [...(log[key] || []), today()];
  try {
    localStorage.setItem(PRAYER_LOG_KEY, JSON.stringify(log));
  } catch {
    // A blocked store costs the record, not the prayer.
  }
  renderRecordState();

  const partner = target.partner && target.partner.name && target.partner.id
    ? { name: String(target.partner.name).slice(0, 40), applicationId: String(target.partner.id) }
    : null;

  fetch("/api/record-prayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, prayed: true, name: "", ...(partner ? { partner } : {}) })
  }).catch(() => {
    // The local record above already succeeded; aggregation is a bonus.
  });
}

// ---------------------------------------------------------------------------

document.querySelectorAll(".length-button").forEach((button) => {
  button.addEventListener("click", () => {
    currentLength = button.dataset.length;
    document.querySelectorAll(".length-button").forEach((other) => {
      const active = other === button;
      other.classList.toggle("is-active", active);
      other.setAttribute("aria-pressed", String(active));
    });
    renderSteps();
  });
});

recordButton.addEventListener("click", recordPrayer);

renderHeader();
renderSteps();
renderRecordState();
