// data.js records unknown values as prose ("학교 정보 없음", "학년 정보 확인 필요").
// Those are notes to the editor and must never reach a reader.
export function realValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/정보\s*(없음|확인\s*필요)/.test(text)) return "";
  if (text === "없음") return "";
  return text;
}

// "학교 / 학년" with whichever halves actually exist; empty when neither does.
export function schoolAndGrade(student, separator = " / ") {
  return [realValue(student.school), realValue(student.grade)].filter(Boolean).join(separator);
}

import { createHash } from "node:crypto";

export const prayerDepartments = {
  preschool: {
    name: "유아-유치부",
    code: "유치",
    accent: "#7f8f47",
    accentSoft: "#dfe6c7",
    students: [
      { id: "preschool-yejin", name: "최예진 (Claire Choi)", school: "학교 정보 없음", grade: "4세", prayer: "하나님의 은혜 안에서 몸과 마음과 영혼이 건강하게 자라고, 어떤 상황에서도 흔들리지 않는 굳건한 믿음과 감사하는 마음을 갖도록 기도해 주세요. 엄마와 아빠와 예진이가 늘 함께하도록 기도해 주세요." },
      { id: "preschool-eunchae", name: "황은채 (Ella Hwang)", school: "학교 정보 없음", grade: "4세", prayer: "아프지 않고 건강하게 잘 자라며 사랑을 전하는 아이가 되고, 가정과 어린이집과 교회에서 하나님의 자녀로 기쁘게 성장하도록 기도해 주세요." },
      { id: "preschool-gion", name: "홍기온 (Caleb Hong)", school: "학교 정보 없음", grade: "Kindergarten", prayer: "하나님의 사랑 안에서 건강하고 밝게 자라며 받은 사랑을 나눌 줄 아는 따뜻한 아이가 되도록 기도해 주세요. 엄마도 건강하고 기도와 사랑이 많은 사람이 되도록 함께 기도해 주세요." },
      { id: "preschool-noel-dawood", name: "노엘 다우드", school: "학교 정보 없음", grade: "나이 정보 없음", prayer: "없음" },
      { id: "preschool-nathan-dawood", name: "나단 다우드", school: "학교 정보 없음", grade: "나이 정보 없음", prayer: "없음" },
      { id: "preschool-jiho", name: "엄지호 (Jiho Eom)", school: "Westwood Preschool", grade: "Kindergarten", prayer: "하나님의 말씀을 삶의 기준으로 삼아 어떤 상황에서도 흔들리지 않는 지호가 되고, 하나님을 사랑하며 학교에서도 늘 지켜 주시도록 기도해 주세요." },
      { id: "preschool-rio", name: "안리오 (Leo Ahn)", school: "학교 정보 없음", grade: "Kindergarten", prayer: "하나님께서 리오를 지켜 주시고 지혜를 더해 주시며, 새로운 학교에 잘 적응하도록 인도해 주세요." },
      { id: "preschool-roi-kim", name: "김로이 (Roy Kim)", school: "학교 정보 없음", grade: "나이 정보 없음", prayer: "없음" }
    ]
  },
  elementaryJr: {
    name: "유년부",
    code: "유년",
    accent: "#4d8552",
    accentSoft: "#d4e4d3",
    students: [
      { id: "elementary-jr-haeum", name: "윤하음 (Jayden Yoon)", school: "학교 정보 없음", grade: "1학년", prayer: "하나님을 사랑하고 경외하며 살아가는 믿음의 하음이로 자라도록 기도해 주세요." },
      { id: "elementary-jr-inyo", name: "이인요 (Inyo Yi)", school: "학교 정보 없음", grade: "2학년", prayer: "누나와 사이좋게 지내고, 혜나와 인요가 어떤 상황에서도 건강하고 행복하도록 기도해 주세요." },
      { id: "elementary-jr-seoyeon", name: "박서연 (Ellie Park)", school: "학교 정보 없음", grade: "2학년", prayer: "항상 건강하고 하나님을 경외하며 주님 안에서 평안한 길을 걷고, 가족도 모두 건강하도록 기도해 주세요." },
      { id: "elementary-jr-jiyul", name: "엄지율 (Evelyn Eom)", school: "학교 정보 없음", grade: "1학년", prayer: "하나님의 사랑이 지율이에게, 또 지율이를 통해 흘러넘치고 하나님께서 기뻐하시는 아이가 되도록 기도해 주세요. 매일 예수님이 마음속에 함께하시고 기쁜 날이 많도록 기도해 주세요." },
      { id: "elementary-jr-yuna", name: "황유나", school: "학교 정보 없음", grade: "학년 정보 없음", prayer: "가족이 하나님을 믿고 서로 사랑하며 믿음 안에서 함께 성장하고, 모두 안전하고 건강하며 늘 서로 사랑하도록 기도해 주세요." },
      { id: "elementary-jr-raon", name: "박라온 (Laon Park)", school: "학교 정보 없음", grade: "2학년", prayer: "2학년에서 좋은 선생님과 친구들을 만나고, 부모님이 건강하도록 기도해 주세요." },
      { id: "elementary-jr-hael", name: "조하엘 (Janice Cho)", school: "학교 정보 없음", grade: "1학년", prayer: "좋은 친구들을 만나 함께 즐겁게 지내도록 기도해 주세요." },
      { id: "elementary-jr-ain", name: "김아인", school: "학교 정보 없음", grade: "학년 정보 없음", prayer: "항상 감사할 수 있고, 좋은 친구를 많이 사귀며 자신을 더 사랑할 수 있도록 기도해 주세요." },
      { id: "elementary-jr-sua", name: "박수아 (Chloe Suah Park)", school: "학교 정보 없음", grade: "Kindergarten", prayer: "없음" },
      { id: "elementary-jr-sophia", name: "이소피아", school: "학교 정보 없음", grade: "학년 정보 없음", prayer: "없음" }
    ]
  },
  elementary: {
    name: "초등부",
    code: "초등",
    accent: "#b55d28",
    accentSoft: "#efd3b8",
    students: [
      { id: "elementary-roi", name: "박로이 (Roi Park)", school: "Highland Ranch Elementary", grade: "4학년", prayer: "예배 시간에 마음을 모아 잘 집중하도록 기도해 주세요." },
      { id: "elementary-seoa", name: "봉서아 (Sara Bong)", school: "Westwood Elementary", grade: "5학년", prayer: "학교에 잘 적응하고 공부도 성실히 하며, 할머니와 할아버지를 만날 수 있도록 기도해 주세요." },
      { id: "elementary-harin", name: "윤하린 (Olivia Yoon)", school: "Turtleback Elementary", grade: "4학년", prayer: "감사함이 넘치는 하린이가 되고, 깨끗한 지구를 함께 만들어 갈 수 있도록 기도해 주세요." },
      { id: "elementary-hajun", name: "김하준", school: "학교 정보 없음", grade: "학년 정보 없음", prayer: "좋은 친구를 많이 사귀고, 아버지가 건강하시도록 기도해 주세요." }
    ]
  },
  youth: {
    name: "중고등부",
    code: "중고등",
    accent: "#41666c",
    accentSoft: "#c9dcda",
    students: [
      { id: "youth-hanseong", name: "고한성 (David Ko)", school: "Olympian High School", grade: "10학년", prayer: "중고등부 공동체가 안전하고 기쁨이 넘치며, 자신도 모든 상황에서 하나님을 신뢰하도록 기도해 주세요." },
      { id: "youth-sunwoo", name: "권순우 (Snuh Kwon)", school: "Scripps Ranch High School", grade: "11학년", prayer: "없음" },
      { id: "youth-yubin", name: "김유빈 (Katie Kim)", school: "Rancho Bernardo High School", grade: "11학년", prayer: "가족이 건강하고 자신의 꿈을 이루며, 무엇보다 사랑이 풍성한 사람이 되도록 기도해 주세요." },
      { id: "youth-yuan", name: "김유안", school: "학교 정보 확인 필요", grade: "6학년", prayer: "하나님께서 늘 함께하심을 믿고 영적 싸움 속에서도 주님을 예배하며, 받은 지혜로 하나님께 영광 돌리도록 기도해 주세요." },
      { id: "youth-jian", name: "김지안", school: "Bernardo Heights Middle School", grade: "학년 정보 없음", prayer: "학교 성적이 학기 끝까지 잘 나오도록 기도해 주세요." },
      { id: "youth-haseo", name: "김하서 (Timothy Kim)", school: "Eastlake High School", grade: "12학년", prayer: "없음" },
      { id: "youth-gyuha", name: "박규하 (Leonard Park)", school: "학교 정보 확인 필요", grade: "9학년", prayer: "없음" },
      { id: "youth-seojun", name: "박서준 (James Park)", school: "Design39 Campus", grade: "6학년", prayer: "친구들과 가족 모두가 하나님을 알고 하나님께 가까이 나아가도록 기도해 주세요." },
      { id: "youth-seoyun", name: "봉서윤 (Seoyoon Bong)", school: "Bernardo Heights Middle School", grade: "7학년", prayer: "영어를 자신 있게 잘할 수 있도록 기도해 주세요." },
      { id: "youth-taehyun", name: "안태현 (Michael Ahn)", school: "CDM", grade: "6학년", prayer: "내년에 시작할 중학교 생활을 건강하고 씩씩하게 잘 헤쳐 나가도록 기도해 주세요." },
      { id: "youth-dayeon", name: "이다연 (Rachel Lee)", school: "Rancho Bernardo High School", grade: "12학년", prayer: "하나님 중심의 삶을 살고 복음을 나눌 수 있도록 기도해 주세요." },
      { id: "youth-yeseul", name: "이예슬 (Sally Lee)", school: "Rancho Bernardo High School", grade: "10학년", prayer: "학교생활에 성실히 임하고 게으름을 이기며, 의무감이 아닌 기쁨으로 교회를 섬기고 하나님을 삶의 중심에 모시도록 기도해 주세요." },
      { id: "youth-yeeun", name: "이예은 (Yeeun Lee)", school: "Rancho Bernardo High School", grade: "12학년", prayer: "감정에만 의지하지 않고 훈련된 관계로 하나님과 동행하며, 믿지 않는 친구에게 용기 있게 복음을 전하도록 기도해 주세요." },
      { id: "youth-jaea", name: "이재아 (Joshua Lee)", school: "Oak Valley Middle School", grade: "8학년", prayer: "없음" },
      { id: "youth-jiwon", name: "이지원 (Amy Lee)", school: "학교 정보 확인 필요", grade: "6학년", prayer: "올해를 기쁘고 행복하게 보내도록 기도해 주세요." },
      { id: "youth-hena", name: "이혜나 (Hena Yi)", school: "학교 정보 없음", grade: "6학년", prayer: "가족이 언제나 행복하고, 혜나와 인요가 어떤 상황에서도 건강하고 행복하도록 기도해 주세요." },
      { id: "youth-yeowon", name: "조여원 (Noel Cho)", school: "Mesa Verde Middle School", grade: "8학년", prayer: "하나님을 찾는 일에 게으르지 않고 학교생활에 성실하며, 걱정을 내려놓고 동기를 얻어 미루는 습관을 이기도록 기도해 주세요." },
      { id: "youth-jia", name: "최지아 (Estella Choi)", school: "학교 정보 확인 필요", grade: "6학년", prayer: "가족이 행복하고 할머니가 잘 회복하시며, 오랫동안 마음에 품어 온 어려움에서도 지아의 마음이 회복되도록 기도해 주세요." },
      { id: "youth-inha", name: "황인하 (Saige Hwang)", school: "Bernardo Heights Middle School", grade: "8학년", prayer: "없음" },
      { id: "youth-dustin-shin", name: "신더스틴 (Dustin Shin)", school: "학교 정보 없음", grade: "7학년", prayer: "없음" },
      { id: "youth-joseph-senethep", name: "조셉 (Joseph Senethep)", school: "Bernardo Heights Middle School", grade: "8학년", prayer: "올해 해야 할 모든 일을 잘 감당하고 끝까지 따라갈 수 있도록 기도해 주세요." },
      { id: "youth-justin-kim", name: "저스틴 (Justin Kim)", school: "Olympian High School", grade: "10학년", prayer: "없음" },
      { id: "youth-tylor-shin", name: "신타일러 (Tylor Shin)", school: "학교 정보 없음", grade: "11학년", prayer: "자신과의 관계가 회복되고 하나님을 더 깊이 찾으며, 건강한 자신감이 자라도록 기도해 주세요." },
      { id: "youth-seoha-lee", name: "이서하 (Sera Lee)", school: "학교 정보 없음", grade: "학년 정보 없음", prayer: "숙제를 잘 마치고 게으름을 이기며, 집안일을 성실히 하고 인내심을 갖도록 기도해 주세요." },
      { id: "youth-habeen-kim", name: "김하빈 (Habeen Kim)", school: "Black Mountain Middle School", grade: "8학년", prayer: "없음" }
    ]
  }
};

export function findPrayerStudent(departmentKey, studentId) {
  const department = prayerDepartments[departmentKey];
  const student = department?.students.find((person) => person.id === studentId);
  return student ? { department, student } : null;
}

export function pickupCodeForStudent(department, student) {
  const index = department.students.findIndex((person) => person.id === student.id);
  return `${department.code}-${String(index + 1).padStart(2, "0")}`;
}

export function selectPrayerStudent(departmentPreference, email, partnerName) {
  const eligible = departmentPreference === "any"
    ? Object.entries(prayerDepartments).flatMap(([departmentKey, department]) =>
        department.students.map((student) => ({ departmentKey, department, student }))
      )
    : (prayerDepartments[departmentPreference]?.students || []).map((student) => ({
        departmentKey: departmentPreference,
        department: prayerDepartments[departmentPreference],
        student
      }));

  if (eligible.length === 0) return null;
  const digest = createHash("sha256").update(`${email}:${partnerName}`).digest();
  return eligible[digest.readUInt32BE(0) % eligible.length];
}
