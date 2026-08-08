export const PAGE2_TEMPLATE = Object.freeze({
  page: 2,
  name: "Parent Consent",
  reference: "assets/templates/page2-reference.png",
  sourceSize: { width: 1437, height: 2048 },
  targetSize: { width: 1440, height: 2048 },
  detectedPageBoundary: { x: 0, y: 0, width: 1437, height: 2048 },
  consent: {
    guardianName: { x: 264, y: 493, width: 367, height: 57, type: "chinese", psm: 7 },
    ic: { x: 825, y: 493, width: 430, height: 57, type: "id", psm: 7 },
    signature: { x: 473, y: 753, width: 405, height: 63, type: "signature" },
    date: { x: 995, y: 753, width: 256, height: 63, type: "date", psm: 7 },
  },
  parentResponse: {
    receiveActivityInformation: { x: 184, y: 1148, width: 50, height: 50 },
    learnChristianFaith: { x: 184, y: 1240, width: 50, height: 50 },
    acceptChurchVisitation: { x: 184, y: 1332, width: 50, height: 50 },
  },
  office: {
    feePerPerson: { x: 486, y: 1582, width: 65, height: 73, type: "money", psm: 7 },
    participantCount: { x: 599, y: 1582, width: 53, height: 73, type: "number", psm: 7 },
    totalFee: { x: 981, y: 1582, width: 307, height: 73, type: "money", psm: 7 },
    amountPaid: { x: 475, y: 1820, width: 188, height: 102, type: "money", psm: 7 },
    paymentDate: { x: 758, y: 1820, width: 160, height: 102, type: "date", psm: 7 },
    receiver: { x: 1042, y: 1820, width: 248, height: 102, type: "text", psm: 7 },
  },
});

export function page2OverlayRegions() {
  const regions = [];
  Object.entries(PAGE2_TEMPLATE.consent).forEach(([name, region]) =>
    regions.push({ page: 2, kind: name === "signature" ? "signature" : "field", label: `Consent ${name}`, ...region }),
  );
  Object.entries(PAGE2_TEMPLATE.parentResponse).forEach(([name, region]) =>
    regions.push({ page: 2, kind: "mark", label: `Parent response: ${name}`, ...region }),
  );
  Object.entries(PAGE2_TEMPLATE.office).forEach(([name, region]) =>
    regions.push({ page: 2, kind: "field", label: `Office ${name}`, ...region }),
  );
  return regions;
}
