function numeric(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateSubmission(data) {
  const warnings = [];
  data.students.forEach((student, index) => {
    if (student.age && !/^\d{1,2}$/.test(student.age)) warnings.push(`Student ${index + 1}: age should contain numbers only.`);
    if (student.dob && !/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(student.dob)) warnings.push(`Student ${index + 1}: check the date of birth (DD/MM/YYYY or DD-MM-YYYY).`);
    if (student.gender === "Needs Review") warnings.push(`Student ${index + 1}: check the gender selection.`);
    if (student.religion === "Needs Review") warnings.push(`Student ${index + 1}: check the religion selection.`);
    if (student.firstTime === "Needs Review") warnings.push(`Student ${index + 1}: check the first-time selection.`);
  });
  if (data.guardian.mobile && !/^[\d+() -]{7,20}$/.test(data.guardian.mobile)) warnings.push("Check the guardian mobile number.");
  if (data.guardian.homePhone && !/^[\d+() -]{7,20}$/.test(data.guardian.homePhone)) warnings.push("Check the home telephone number.");
  if (data.guardian.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guardian.email)) warnings.push("Check the email address.");
  if (data.consent.date && !/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(data.consent.date)) warnings.push("Check the parent consent date.");
  if (data.consent.signaturePresent === "Needs Review") warnings.push("Check whether the guardian signature is present.");
  if (Object.values(data.parentResponse).some((value) => value === null)) warnings.push("One or more parent-response circles need review.");

  const fee = numeric(data.office.feePerPerson);
  const people = numeric(data.office.participantCount);
  const total = numeric(data.office.totalFee);
  if (data.office.feePerPerson && fee === null) warnings.push("Check the registration fee per person.");
  if (data.office.participantCount && people === null) warnings.push("Check the number of people.");
  if (data.office.totalFee && total === null) warnings.push("Check the total registration fee.");
  if (fee !== null && people !== null && total !== null && Math.abs(fee * people - total) > 0.009) {
    warnings.push(`Please check registration fee: ${fee} × ${people} = ${(fee * people).toFixed(2)}, not ${total.toFixed(2)}.`);
  }
  return warnings;
}

export function isStudentEmpty(student) {
  return !Object.values(student).some((value) => String(value ?? "").trim() && value !== "Needs Review");
}
