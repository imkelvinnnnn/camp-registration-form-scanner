import assert from "node:assert/strict";
import test from "node:test";
import { chooseExclusiveFromRatios } from "../js/markDetector.js";
import { isStudentEmpty, validateSubmission } from "../js/validation.js";

function validData() {
  return {
    students: [{ chineseName: "王小明", englishName: "John", dob: "12/05/2016", age: "10", gender: "Male", religion: "Christianity", firstTime: "Yes" }],
    guardian: { mobile: "012-3456789", homePhone: "03-12345678", email: "parent@example.com" },
    consent: { date: "08/08/2026", signaturePresent: "Yes" },
    parentResponse: { receiveActivityInformation: true, learnChristianFaith: false, acceptChurchVisitation: true },
    office: { feePerPerson: "50", participantCount: "2", totalFee: "100" },
  };
}

test("accepts a consistent verified submission", () => {
  assert.deepEqual(validateSubmission(validData()), []);
});

test("warns when the registration fee does not match", () => {
  const data = validData();
  data.office.totalFee = "90";
  assert.match(validateSubmission(data).join(" "), /Please check registration fee/);
});

test("warns about ambiguous mark detection", () => {
  const data = validData();
  data.students[0].gender = "Needs Review";
  data.parentResponse.learnChristianFaith = null;
  const warnings = validateSubmission(data).join(" ");
  assert.match(warnings, /gender selection/);
  assert.match(warnings, /parent-response circles/);
});

test("keeps phone numbers as strings", () => {
  const data = validData();
  assert.equal(data.guardian.mobile.startsWith("0"), true);
  assert.equal(validateSubmission(data).length, 0);
});

test("identifies a completely empty student row", () => {
  assert.equal(isStudentEmpty({ chineseName: "", englishName: "", dob: "", age: "", gender: "", religion: "", firstTime: "" }), true);
  assert.equal(isStudentEmpty({ chineseName: "", englishName: "Mary", dob: "", age: "", gender: "", religion: "", firstTime: "" }), false);
});

test("chooses a clearly crossed circle using relative ink", () => {
  assert.equal(chooseExclusiveFromRatios({ male: 0.075, female: 0.004 }), "male");
  assert.equal(chooseExclusiveFromRatios({ christianity: 0.065, taoism: 0.02, buddhism: 0.004, other: 0.003 }), "christianity");
  assert.equal(chooseExclusiveFromRatios({ yes: 0.035, no: 0.031 }), "Needs Review");
  assert.equal(chooseExclusiveFromRatios({ yes: 0.003, no: 0.002 }), "");
});
