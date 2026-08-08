const CONFIG = Object.freeze({
  spreadsheetId: 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
  sheetName: 'Registrations',
});

const HEADERS = Object.freeze([
  'Submission Timestamp',
  'Chinese Name',
  'English Name',
  'DOB',
  'Age',
  'Gender',
  'Religion',
  'First Time',
  'Guardian Chinese Name',
  'Guardian English Name',
  'Mobile',
  'Home Phone',
  'Email',
  'Address',
  'Remarks',
  'Invited By',
  'Consent Name',
  'IC',
  'Signature Present',
  'Consent Date',
  'Receive Activity Information',
  'Learn Christian Faith',
  'Accept Church Visitation',
  'Fee Per Person',
  'Number of People',
  'Total Fee',
  'Amount Paid',
  'Payment Date',
  'Receiver',
]);

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function safeCell_(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function booleanCell_(value) {
  if (value === null || value === undefined) return 'Needs Review';
  return value ? 'Yes' : 'No';
}

function getSheet_() {
  if (CONFIG.spreadsheetId.indexOf('PASTE_') === 0) throw new Error('Configure spreadsheetId in Code.gs first.');
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return spreadsheet.getSheetByName(CONFIG.sheetName) || spreadsheet.insertSheet(CONFIG.sheetName);
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#24594d').setFontColor('#ffffff');
  }
}

function studentRow_(data, student, timestamp) {
  const guardian = data.guardian || {};
  const consent = data.consent || {};
  const response = data.parentResponse || {};
  const office = data.office || {};
  return [
    timestamp,
    student.chineseName,
    student.englishName,
    student.dob,
    student.age,
    student.gender,
    student.religion,
    student.firstTime,
    guardian.chineseName,
    guardian.englishName,
    guardian.mobile,
    guardian.homePhone,
    guardian.email,
    guardian.address,
    guardian.remarks,
    guardian.invitedBy,
    consent.guardianName,
    consent.ic,
    consent.signaturePresent,
    consent.date,
    booleanCell_(response.receiveActivityInformation),
    booleanCell_(response.learnChristianFaith),
    booleanCell_(response.acceptChurchVisitation),
    office.feePerPerson,
    office.participantCount,
    office.totalFee,
    office.amountPaid,
    office.paymentDate,
    office.receiver,
  ].map(safeCell_);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('No submission data received.');
    const data = JSON.parse(e.postData.contents);
    if (!Array.isArray(data.students) || data.students.length === 0) throw new Error('At least one student is required.');
    const timestamp = new Date();
    const rows = data.students.map(function(student) { return studentRow_(data, student, timestamp); });
    lock.waitLock(20000);
    const sheet = getSheet_();
    ensureHeaders_(sheet);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, rowsAdded: rows.length });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || String(error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse_({ ok: true, service: 'Registration Form Scanner', configured: CONFIG.spreadsheetId.indexOf('PASTE_') !== 0 });
}
