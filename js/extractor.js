import { APP_CONFIG } from "../config/app-config.js";
import { PAGE1_TEMPLATE } from "../config/page1-template.js";
import { PAGE2_TEMPLATE } from "../config/page2-template.js";
import { loadImage } from "./imageProcessor.js";
import { BrowserOcr } from "./ocr.js";
import { detectExclusiveGroup, detectMark, extraInkRatio } from "./markDetector.js";

function referenceCanvas(image, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, size.width, size.height);
  return canvas;
}

function prettifyChoice(value) {
  const labels = {
    male: "Male",
    female: "Female",
    christianity: "Christianity",
    taoism: "Taoism",
    buddhism: "Buddhism",
    other: "Other",
    yes: "Yes",
    no: "No",
  };
  return labels[value] || value;
}

function pushMarkDebug(debug, page, prefix, groupResult, choices) {
  Object.entries(groupResult.details).forEach(([choice, result]) => {
    debug.push({
      kind: "mark",
      page,
      label: `${prefix}: ${prettifyChoice(choice)}`,
      region: choices[choice],
      result: result.state,
      confidence: Math.min(100, Math.round(Math.abs(result.ratio - 0.008) * 7000)),
      inkRatio: result.ratio,
    });
  });
}

export async function extractForms(page1Canvas, page2Canvas, onProgress = () => {}) {
  const [page1Image, page2Image] = await Promise.all([
    loadImage(PAGE1_TEMPLATE.reference),
    loadImage(PAGE2_TEMPLATE.reference),
  ]);
  const page1Blank = referenceCanvas(page1Image, PAGE1_TEMPLATE.targetSize);
  const page2Blank = referenceCanvas(page2Image, PAGE2_TEMPLATE.targetSize);
  const debug = [];
  let completed = 0;
  const estimatedOperations = 48;
  const tick = (label) => {
    completed += 1;
    onProgress({ percent: Math.min(98, 38 + Math.round(completed / estimatedOperations * 60)), label });
  };
  const ocr = new BrowserOcr(APP_CONFIG.ocrLanguages, (message) => {
    if (message.status === "recognizing text") onProgress({ label: "Reading handwriting…" });
  });

  onProgress({ percent: 36, label: "Starting handwriting recognition…" });
  await ocr.start();
  try {
    const students = [];
    for (const studentSpec of PAGE1_TEMPLATE.students) {
      const gender = detectExclusiveGroup(page1Canvas, page1Blank, studentSpec.marks.gender);
      const religion = detectExclusiveGroup(page1Canvas, page1Blank, studentSpec.marks.religion);
      const firstTime = detectExclusiveGroup(page1Canvas, page1Blank, studentSpec.marks.firstTime);
      pushMarkDebug(debug, 1, `${studentSpec.label} gender`, gender, studentSpec.marks.gender);
      pushMarkDebug(debug, 1, `${studentSpec.label} religion`, religion, studentSpec.marks.religion);
      pushMarkDebug(debug, 1, `${studentSpec.label} first time`, firstTime, studentSpec.marks.firstTime);

      const containsWriting = Object.values(studentSpec.fields).some((region) => extraInkRatio(page1Canvas, page1Blank, region) >= 0.0012);
      const containsMark = [gender, religion, firstTime].some((group) => group.value);
      if (!containsWriting && !containsMark) {
        tick(`Skipped empty ${studentSpec.label.toLowerCase()}`);
        continue;
      }

      const student = {};
      for (const [field, spec] of Object.entries(studentSpec.fields)) {
        const result = await ocr.recognize(page1Canvas, page1Blank, spec, `${studentSpec.label} ${field}`, 1, debug);
        student[field] = result.text;
        tick(`Read ${studentSpec.label.toLowerCase()} ${field}`);
      }
      student.gender = prettifyChoice(gender.value);
      student.religion = prettifyChoice(religion.value);
      student.firstTime = prettifyChoice(firstTime.value);
      students.push(student);
    }

    const guardian = {};
    for (const [field, spec] of Object.entries(PAGE1_TEMPLATE.guardian)) {
      const result = await ocr.recognize(page1Canvas, page1Blank, spec, `Guardian ${field}`, 1, debug);
      guardian[field] = result.text;
      tick(`Read guardian ${field}`);
    }

    const consent = {};
    for (const field of ["guardianName", "ic", "date"]) {
      const spec = PAGE2_TEMPLATE.consent[field];
      const result = await ocr.recognize(page2Canvas, page2Blank, spec, `Consent ${field}`, 2, debug);
      consent[field] = result.text;
      tick(`Read consent ${field}`);
    }
    const signatureRegion = PAGE2_TEMPLATE.consent.signature;
    const signatureInk = extraInkRatio(page2Canvas, page2Blank, signatureRegion);
    consent.signaturePresent = signatureInk >= 0.006 ? "Yes" : signatureInk <= 0.0015 ? "No" : "Needs Review";
    debug.push({ kind: "signature", page: 2, label: "Guardian signature", region: signatureRegion, result: consent.signaturePresent, confidence: Math.min(100, Math.round(Math.abs(signatureInk - 0.0035) * 25000)), inkRatio: signatureInk });
    tick("Checked guardian signature");

    const parentResponse = {};
    for (const [field, region] of Object.entries(PAGE2_TEMPLATE.parentResponse)) {
      const detection = detectMark(page2Canvas, page2Blank, region);
      parentResponse[field] = detection.state === "selected" ? true : detection.state === "not-selected" ? false : null;
      debug.push({ kind: "mark", page: 2, label: `Parent response ${field}`, region, result: detection.state, confidence: Math.min(100, Math.round(Math.abs(detection.ratio - 0.008) * 7000)), inkRatio: detection.ratio });
      tick(`Checked parent response ${field}`);
    }

    const office = {};
    for (const [field, spec] of Object.entries(PAGE2_TEMPLATE.office)) {
      const result = await ocr.recognize(page2Canvas, page2Blank, spec, `Office ${field}`, 2, debug);
      office[field] = result.text;
      tick(`Read office ${field}`);
    }

    const ocrWarnings = debug
      .filter((item) => item.kind === "ocr" && item.result && item.confidence < 55)
      .map((item) => ({ label: item.label, confidence: Math.round(item.confidence) }));

    return {
      version: 1,
      extractedAt: new Date().toISOString(),
      students,
      guardian,
      consent,
      parentResponse,
      office,
      ocrWarnings,
      debug,
    };
  } finally {
    await ocr.stop();
  }
}
