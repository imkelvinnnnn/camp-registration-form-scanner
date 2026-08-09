export const PAGE1_TEMPLATE = Object.freeze({
  page: 1,
  name: "Student & Contact Information",
  reference: "assets/templates/page1-reference.png",
  sourceSize: { width: 1440, height: 2048 },
  targetSize: { width: 1440, height: 2048 },
  detectedPageBoundary: { x: 0, y: 0, width: 1440, height: 2048 },
  studentTable: {
    columns: [29, 254, 694, 861, 935, 1033, 1268, 1384],
    rows: [325, 435, 545, 656, 767, 877, 988],
  },
  students: [325, 435, 545, 656, 767, 877].map((top, index) => ({
    key: `student${index + 1}`,
    label: `Student ${index + 1}`,
    fields: {
      chineseName: { x: 36, y: top + 4, width: 211, height: 102, type: "chinese", psm: 7 },
      englishName: { x: 260, y: top + 4, width: 427, height: 102, type: "english", psm: 7 },
      dob: { x: 700, y: top + 5, width: 153, height: 100, type: "date", psm: 7 },
      age: { x: 867, y: top + 5, width: 62, height: 100, type: "number", psm: 7 },
    },
    marks: {
      gender: {
        male: { x: 949, y: top + 10, width: 43, height: 43 },
        female: { x: 949, y: top + 51, width: 43, height: 43 },
      },
      religion: {
        christianity: { x: 1038, y: top + 10, width: 43, height: 43 },
        taoism: { x: 1165, y: top + 10, width: 43, height: 43 },
        buddhism: { x: 1038, y: top + 51, width: 43, height: 43 },
        other: { x: 1165, y: top + 51, width: 43, height: 43 },
      },
      firstTime: {
        yes: { x: 1292, y: top + 10, width: 43, height: 43 },
        no: { x: 1292, y: top + 51, width: 43, height: 43 },
      },
    },
  })),
  guardian: {
    chineseName: { x: 194, y: 1167, width: 300, height: 60, type: "chinese", psm: 7 },
    englishName: { x: 760, y: 1167, width: 607, height: 60, type: "english", psm: 7 },
    mobile: { x: 194, y: 1233, width: 478, height: 60, type: "phone", psm: 7 },
    homePhone: { x: 836, y: 1233, width: 531, height: 60, type: "phone", psm: 7 },
    email: { x: 194, y: 1300, width: 1173, height: 59, type: "email", psm: 7 },
    address: {
      type: "multiline",
      psm: 7,
      regions: [
        { x: 194, y: 1366, width: 1173, height: 60 },
        { x: 55, y: 1432, width: 1312, height: 60 },
        { x: 55, y: 1499, width: 1312, height: 59 },
        { x: 55, y: 1565, width: 1312, height: 60 },
      ],
    },
    remarks: {
      type: "multiline",
      psm: 7,
      regions: [
        { x: 735, y: 1632, width: 632, height: 59 },
        { x: 55, y: 1698, width: 1312, height: 59 },
        { x: 55, y: 1764, width: 1312, height: 60 },
        { x: 55, y: 1831, width: 1312, height: 58 },
      ],
    },
    invitedBy: { x: 194, y: 1896, width: 1173, height: 59, type: "text", psm: 7 },
  },
});

export function page1OverlayRegions() {
  const regions = [];
  PAGE1_TEMPLATE.students.forEach((student) => {
    Object.entries(student.fields).forEach(([name, region]) =>
      regions.push({ page: 1, kind: "field", label: `${student.label} ${name}`, ...region }),
    );
    Object.entries(student.marks).forEach(([group, choices]) => {
      Object.entries(choices).forEach(([choice, region]) =>
        regions.push({ page: 1, kind: "mark", label: `${student.label} ${group}: ${choice}`, ...region }),
      );
    });
  });
  Object.entries(PAGE1_TEMPLATE.guardian).forEach(([name, spec]) => {
    const items = spec.regions || [spec];
    items.forEach((region, i) =>
      regions.push({ page: 1, kind: "field", label: `Guardian ${name}${items.length > 1 ? ` line ${i + 1}` : ""}`, ...region }),
    );
  });
  return regions;
}
