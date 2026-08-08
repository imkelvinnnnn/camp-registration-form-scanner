import { APP_CONFIG } from "../config/app-config.js";
import { page1OverlayRegions } from "../config/page1-template.js";
import { page2OverlayRegions } from "../config/page2-template.js";
import { canvasFromDataUrl } from "./imageProcessor.js";
import { cropCanvas } from "./markDetector.js";
import { submitToGoogleSheets } from "./sheets.js";
import { clearTemporaryData, loadScan, loadTemporaryImage, saveScan } from "./storage.js";
import { isStudentEmpty, validateSubmission } from "./validation.js";

const fieldContainer = document.querySelector("#verification-fields");
const form = document.querySelector("#verification-form");
const warningPanel = document.querySelector("#warning-panel");
const submitDialog = document.querySelector("#submit-dialog");
const debugPanel = document.querySelector("#debug-panel");
let scan = loadScan();

if (!scan) window.location.replace("index.html");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function inputField(label, field, value = "", options = {}) {
  const wrapper = element("div", `field${options.full ? " full" : ""}`);
  const labelNode = element("label", "", label);
  const id = `${field}-${Math.random().toString(36).slice(2, 8)}`;
  labelNode.htmlFor = id;
  let control;
  if (options.multiline) {
    control = document.createElement("textarea");
  } else if (options.choices) {
    control = document.createElement("select");
    options.choices.forEach(([choiceValue, choiceLabel]) => {
      const option = document.createElement("option");
      option.value = choiceValue;
      option.textContent = choiceLabel;
      control.append(option);
    });
  } else {
    control = document.createElement("input");
    control.type = options.type || "text";
    if (options.inputMode) control.inputMode = options.inputMode;
  }
  control.id = id;
  control.dataset.field = field;
  control.value = value ?? "";
  wrapper.append(labelNode, control);
  return wrapper;
}

function section(title, eyebrow) {
  const container = element("section", "form-section");
  const heading = element("div", "section-title");
  const group = document.createElement("div");
  group.append(element("p", "eyebrow accent", eyebrow), element("h2", "", title));
  heading.append(group);
  container.append(heading);
  return { container, heading };
}

function renderStudentCard(student, position) {
  const card = element("article", "student-card");
  card.dataset.studentIndex = String(position);
  const heading = element("div", "student-card-header");
  heading.append(element("h3", "", `Student ${position + 1}`));
  const remove = element("button", "remove-student", "Remove");
  remove.type = "button";
  remove.addEventListener("click", () => {
    card.remove();
    renumberStudents();
  });
  heading.append(remove);
  const grid = element("div", "field-grid");
  grid.append(
    inputField("Chinese Name / 华文名", "chineseName", student.chineseName),
    inputField("English Name / 英文名", "englishName", student.englishName),
    inputField("Date of Birth / 生日", "dob", student.dob, { inputMode: "numeric" }),
    inputField("Age / 年龄", "age", student.age, { inputMode: "numeric" }),
    inputField("Gender / 性别", "gender", student.gender, { choices: [["", "— Select —"], ["Male", "Male / 男"], ["Female", "Female / 女"], ["Needs Review", "Needs Review"]] }),
    inputField("Religion / 宗教信仰", "religion", student.religion, { choices: [["", "— Select —"], ["Christianity", "Christianity / 基督教"], ["Taoism", "Taoism / 道教"], ["Buddhism", "Buddhism / 佛教"], ["Other", "Other / 其他"], ["Needs Review", "Needs Review"]] }),
    inputField("First Time / 第一次参加", "firstTime", student.firstTime, { choices: [["", "— Select —"], ["Yes", "Yes / 是"], ["No", "No / 否"], ["Needs Review", "Needs Review"]] }),
  );
  card.append(heading, grid);
  return card;
}

function renumberStudents() {
  document.querySelectorAll(".student-card").forEach((card, index) => {
    card.dataset.studentIndex = String(index);
    card.querySelector("h3").textContent = `Student ${index + 1}`;
  });
}

function renderForm() {
  const studentsSection = section("Students", "Page 1");
  const add = element("button", "small-button", "+ Add student");
  add.type = "button";
  studentsSection.heading.append(add);
  const studentList = element("div", "student-list");
  const initialStudents = scan.students.length ? scan.students : [{ chineseName: "", englishName: "", dob: "", age: "", gender: "", religion: "", firstTime: "" }];
  initialStudents.forEach((student, index) => studentList.append(renderStudentCard(student, index)));
  add.addEventListener("click", () => {
    if (studentList.children.length >= 6) return;
    studentList.append(renderStudentCard({}, studentList.children.length));
  });
  studentsSection.container.append(studentList);

  const guardianSection = section("Contact Information", "Parent / Guardian");
  const guardianGrid = element("div", "field-grid");
  guardianGrid.append(
    inputField("Chinese Name / 华文名", "guardian.chineseName", scan.guardian.chineseName),
    inputField("English Name / 英文名", "guardian.englishName", scan.guardian.englishName),
    inputField("Mobile / 手机号码", "guardian.mobile", scan.guardian.mobile, { inputMode: "tel" }),
    inputField("Home Telephone / 住家电话", "guardian.homePhone", scan.guardian.homePhone, { inputMode: "tel" }),
    inputField("Email / 电子邮址", "guardian.email", scan.guardian.email, { type: "email", full: true }),
    inputField("Residential Address / 住家地址", "guardian.address", scan.guardian.address, { multiline: true, full: true }),
    inputField("Remarks / 意见、备注", "guardian.remarks", scan.guardian.remarks, { multiline: true, full: true }),
    inputField("Invited By / 邀请者", "guardian.invitedBy", scan.guardian.invitedBy, { full: true }),
  );
  guardianSection.container.append(guardianGrid);

  const consentSection = section("Parent Consent", "Page 2");
  const consentGrid = element("div", "field-grid");
  consentGrid.append(
    inputField("Parent / Guardian Name", "consent.guardianName", scan.consent.guardianName),
    inputField("IC / Identification Number", "consent.ic", scan.consent.ic),
    inputField("Signature", "consent.signaturePresent", scan.consent.signaturePresent, { choices: [["Yes", "Yes"], ["No", "No"], ["Needs Review", "Needs Review"]] }),
    inputField("Date", "consent.date", scan.consent.date, { inputMode: "numeric" }),
  );
  consentSection.container.append(consentGrid);

  const responseSection = section("Parent Response", "Three independent selections");
  const checkboxList = element("div", "checkbox-list");
  [
    ["receiveActivityInformation", "Receive church activity information"],
    ["learnChristianFaith", "Learn more about the Christian faith"],
    ["acceptChurchVisitation", "Accept church care and visitation"],
  ].forEach(([field, label]) => {
    const row = element("label", "checkbox-row");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.field = `parentResponse.${field}`;
    checkbox.checked = scan.parentResponse[field] === true;
    checkbox.indeterminate = scan.parentResponse[field] === null;
    checkbox.addEventListener("change", () => { checkbox.indeterminate = false; });
    row.append(checkbox, document.createTextNode(label));
    checkboxList.append(row);
  });
  responseSection.container.append(checkboxList);

  const officeSection = section("Office Use", "Payment details");
  const officeGrid = element("div", "field-grid three");
  officeGrid.append(
    inputField("Fee Per Person (RM)", "office.feePerPerson", scan.office.feePerPerson, { inputMode: "decimal" }),
    inputField("Number of People", "office.participantCount", scan.office.participantCount, { inputMode: "numeric" }),
    inputField("Total Registration Fee (RM)", "office.totalFee", scan.office.totalFee, { inputMode: "decimal" }),
    inputField("Amount Paid (RM)", "office.amountPaid", scan.office.amountPaid, { inputMode: "decimal" }),
    inputField("Payment Date", "office.paymentDate", scan.office.paymentDate, { inputMode: "numeric" }),
    inputField("Receiver", "office.receiver", scan.office.receiver),
  );
  officeSection.container.append(officeGrid);

  fieldContainer.append(studentsSection.container, guardianSection.container, consentSection.container, responseSection.container, officeSection.container);
}

function collectGroup(prefix, fields) {
  return Object.fromEntries(fields.map((field) => [field, form.querySelector(`[data-field="${prefix}.${field}"]`).value.trim()]));
}

function collectData() {
  const students = Array.from(document.querySelectorAll(".student-card")).map((card) => ({
    chineseName: card.querySelector('[data-field="chineseName"]').value.trim(),
    englishName: card.querySelector('[data-field="englishName"]').value.trim(),
    dob: card.querySelector('[data-field="dob"]').value.trim(),
    age: card.querySelector('[data-field="age"]').value.trim(),
    gender: card.querySelector('[data-field="gender"]').value,
    religion: card.querySelector('[data-field="religion"]').value,
    firstTime: card.querySelector('[data-field="firstTime"]').value,
  })).filter((student) => !isStudentEmpty(student));

  return {
    version: 1,
    extractedAt: scan.extractedAt,
    confirmedAt: new Date().toISOString(),
    students,
    guardian: collectGroup("guardian", ["chineseName", "englishName", "mobile", "homePhone", "email", "address", "remarks", "invitedBy"]),
    consent: collectGroup("consent", ["guardianName", "ic", "signaturePresent", "date"]),
    parentResponse: Object.fromEntries(["receiveActivityInformation", "learnChristianFaith", "acceptChurchVisitation"].map((field) => {
      const checkbox = form.querySelector(`[data-field="parentResponse.${field}"]`);
      return [field, checkbox.indeterminate ? null : checkbox.checked];
    })),
    office: collectGroup("office", ["feePerPerson", "participantCount", "totalFee", "amountPaid", "paymentDate", "receiver"]),
  };
}

function showWarnings(warnings, extraMessage = "") {
  if (!warnings.length && !extraMessage) {
    warningPanel.hidden = true;
    return;
  }
  warningPanel.replaceChildren();
  if (extraMessage) warningPanel.append(element("strong", "", extraMessage));
  if (warnings.length) {
    const list = document.createElement("ul");
    warnings.forEach((warning) => list.append(element("li", "", warning)));
    warningPanel.append(list);
  }
  warningPanel.hidden = false;
}

async function renderDebug() {
  const isDebug = new URLSearchParams(window.location.search).get(APP_CONFIG.debugQueryParameter) === "true";
  if (!isDebug) return;
  debugPanel.hidden = false;
  const content = document.querySelector("#debug-content");
  const dataUrls = await Promise.all([loadTemporaryImage("normalized-page-1"), loadTemporaryImage("normalized-page-2")]);
  const canvases = await Promise.all(dataUrls.map((url) => canvasFromDataUrl(url)));
  const regionSets = [page1OverlayRegions(), page2OverlayRegions()];
  canvases.forEach((source, pageIndex) => {
    const card = element("article", "overlay-card");
    card.append(element("h3", "", `Page ${pageIndex + 1} coordinate overlay`));
    const overlay = document.createElement("canvas");
    overlay.className = "overlay-canvas";
    overlay.width = source.width;
    overlay.height = source.height;
    const context = overlay.getContext("2d");
    context.drawImage(source, 0, 0);
    context.font = "16px system-ui";
    context.lineWidth = 3;
    regionSets[pageIndex].forEach((region) => {
      const color = region.kind === "mark" ? "#d83a52" : region.kind === "signature" ? "#7b43cc" : "#008b70";
      context.strokeStyle = color;
      context.fillStyle = `${color}22`;
      context.fillRect(region.x, region.y, region.width, region.height);
      context.strokeRect(region.x, region.y, region.width, region.height);
      context.fillStyle = color;
      context.fillText(region.label, region.x + 3, Math.max(16, region.y - 4));
    });
    card.append(overlay);
    content.append(card);
  });

  const crops = element("div", "debug-crops");
  scan.debug.forEach((item) => {
    const card = element("article", "debug-crop");
    card.append(element("h3", "", item.label));
    card.append(cropCanvas(canvases[item.page - 1], item.region));
    const details = document.createElement("dl");
    [["Result", item.result || "(blank)"], ["Confidence", `${Math.round(item.confidence)}%`], ["Extra ink", `${(item.inkRatio * 100).toFixed(2)}%`]].forEach(([name, value]) => {
      details.append(element("dt", "", name), element("dd", "", value));
    });
    card.append(details);
    crops.append(card);
  });
  content.append(crops);
}

renderForm();
renderDebug().catch((error) => showWarnings([], `Debug view error: ${error.message}`));

form.addEventListener("input", () => {
  scan = { ...scan, ...collectData(), debug: scan.debug };
  saveScan(scan);
  showWarnings(validateSubmission(scan));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = collectData();
  const warnings = validateSubmission(data);
  if (!data.students.length) {
    showWarnings(warnings, "At least one student is needed before submitting.");
    warningPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  showWarnings(warnings, warnings.length ? "Please note these warnings. Submission will still continue." : "");
  submitDialog.showModal();
  document.querySelector("#submit-button").disabled = true;
  try {
    await submitToGoogleSheets(data);
    await clearTemporaryData();
    window.location.href = "success.html";
  } catch (error) {
    submitDialog.close();
    document.querySelector("#submit-button").disabled = false;
    showWarnings(warnings, error.message);
    warningPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
