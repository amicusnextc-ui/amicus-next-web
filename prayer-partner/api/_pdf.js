import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

function hexColor(value) {
  const hex = value.replace("#", "");
  return rgb(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255
  );
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  function pushLongWord(word) {
    let fragment = "";
    for (const character of [...word]) {
      const candidate = `${fragment}${character}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        fragment = candidate;
      } else {
        if (fragment) lines.push(fragment);
        fragment = character;
      }
    }
    return fragment;
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = font.widthOfTextAtSize(word, size) <= maxWidth ? word : pushLongWord(word);
    }
  }

  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(page, text, options) {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color
    });
  });
}

export async function createPrayerCardPdf({ partnerName, department, student, pickupCode }) {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.registerFontkit(fontkit);
  const fontBytes = await readFile(new URL("./fonts/NanumGothic-Regular.ttf", import.meta.url));
  const cardBackgroundBytes = await readFile(new URL("../assets/prayer-card-hand-bg-v1.png", import.meta.url));
  const font = await pdfDocument.embedFont(fontBytes);
  const cardBackground = await pdfDocument.embedPng(cardBackgroundBytes);
  const page = pdfDocument.addPage([420, 560]);
  const olive = hexColor("#536443");
  const oliveMuted = hexColor("#68775a");
  const oliveDark = hexColor("#465638");
  const rule = hexColor("#8b967c");

  pdfDocument.setTitle(`${student.name} 학생 기도동행 카드`);
  pdfDocument.setAuthor("AMICUS NEXT CHURCH");
  pdfDocument.setSubject("2026 가을학기 기도동행 학생 기도카드");
  pdfDocument.setLanguage("ko-KR");

  page.drawImage(cardBackground, { x: 0, y: 0, width: 420, height: 560 });

  const primaryStudentName = student.name.split(" (")[0].trim();
  const studentInitials = [...primaryStudentName].slice(-2).join("");
  const initialsWidth = font.widthOfTextAtSize(studentInitials, 18);
  page.drawText(studentInitials, { x: 75 - initialsWidth / 2, y: 478, size: 18, font, color: olive });

  page.drawText("2026 가을학기", { x: 268, y: 526, size: 8.5, font, color: oliveMuted });
  page.drawText(`${department.name} · ${pickupCode}`, { x: 268, y: 510, size: 8.5, font, color: olive });

  page.drawText("이름", { x: 32, y: 394, size: 11, font, color: olive });
  drawWrappedText(page, student.name, {
    x: 96,
    y: 394,
    size: 15,
    lineHeight: 17,
    maxWidth: 286,
    font,
    color: oliveDark
  });
  page.drawLine({ start: { x: 94, y: 365 }, end: { x: 382, y: 365 }, thickness: 0.7, color: rule });

  page.drawText("학교 / 학년", { x: 32, y: 342, size: 10.5, font, color: olive });
  drawWrappedText(page, `${student.school} / ${student.grade}`, {
    x: 112,
    y: 342,
    size: 8.5,
    lineHeight: 12,
    maxWidth: 125,
    font,
    color: oliveDark
  });
  page.drawLine({ start: { x: 111, y: 322 }, end: { x: 236, y: 322 }, thickness: 0.7, color: rule });

  page.drawText("기도 제목", { x: 32, y: 274, size: 14, font, color: olive });
  page.drawLine({ start: { x: 32, y: 262 }, end: { x: 224, y: 262 }, thickness: 0.7, color: rule });
  drawWrappedText(page, student.prayer, {
    x: 32,
    y: 244,
    size: 10.5,
    lineHeight: 18,
    maxWidth: 192,
    font,
    color: oliveDark
  });

  page.drawLine({ start: { x: 32, y: 96 }, end: { x: 214, y: 96 }, thickness: 0.55, color: rule });
  page.drawText(`${partnerName}님의 한 학기 기도동행 카드`, { x: 32, y: 70, size: 8.5, font, color: oliveMuted });
  page.drawText("학생 정보와 기도제목은 기도 목적으로만 사용해 주세요.", { x: 32, y: 52, size: 7.5, font, color: oliveMuted });
  page.drawText("AMICUS NEXT CHURCH", { x: 32, y: 31, size: 8, font, color: olive });

  return pdfDocument.save();
}
