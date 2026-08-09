export function cropCanvas(source, region, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(
    source,
    region.x, region.y, region.width, region.height,
    0, 0, canvas.width, canvas.height,
  );
  return canvas;
}

function luminance(data, offset) {
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
}

function medianLuminance(data) {
  const histogram = new Uint32Array(256);
  for (let offset = 0; offset < data.length; offset += 4) {
    histogram[Math.max(0, Math.min(255, Math.round(luminance(data, offset))))] += 1;
  }
  const midpoint = data.length / 8;
  let counted = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    counted += histogram[value];
    if (counted >= midpoint) return value;
  }
  return 255;
}

export function extraInkRatio(photoCanvas, blankCanvas, region) {
  const photo = cropCanvas(photoCanvas, region);
  const blank = cropCanvas(blankCanvas, region);
  const photoData = photo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, photo.width, photo.height).data;
  const blankData = blank.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, blank.width, blank.height).data;
  const inkThreshold = Math.max(75, Math.min(175, medianLuminance(photoData) - 35));
  const width = photo.width;
  const height = photo.height;
  let extraDark = 0;
  let inspected = 0;

  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const index = (y * width + x) * 4;
      const photoLum = luminance(photoData, index);
      if (photoLum > 165) continue;
      inspected += 1;
      let templateIsClear = true;
      for (let dy = -2; dy <= 2 && templateIsClear; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const neighbor = ((y + dy) * width + x + dx) * 4;
          if (luminance(blankData, neighbor) < 175) {
            templateIsClear = false;
            break;
          }
        }
      }
      if (templateIsClear && luminance(blankData, index) - photoLum > 32) extraDark += 1;
    }
  }
  return extraDark / Math.max(1, (width - 4) * (height - 4));
}

export function detectMark(photoCanvas, blankCanvas, region) {
  const photo = cropCanvas(photoCanvas, region);
  const blank = cropCanvas(blankCanvas, region);
  const photoData = photo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, photo.width, photo.height).data;
  const blankData = blank.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, blank.width, blank.height).data;
  const marginX = Math.max(3, Math.round(photo.width * 0.22));
  const marginY = Math.max(3, Math.round(photo.height * 0.22));
  let ink = 0;
  let inspected = 0;
  for (let y = marginY; y < photo.height - marginY; y += 1) {
    for (let x = marginX; x < photo.width - marginX; x += 1) {
      const index = (y * photo.width + x) * 4;
      const photoLum = luminance(photoData, index);
      const blankLum = luminance(blankData, index);
      if (photoLum < inkThreshold && blankLum > 185 && blankLum - photoLum > 24) ink += 1;
      inspected += 1;
    }
  }
  const ratio = ink / Math.max(1, inspected);
  if (ratio >= 0.018) return { state: "selected", ratio };
  if (ratio <= 0.008) return { state: "not-selected", ratio };
  return { state: "needs-review", ratio };
}

export function chooseExclusiveFromRatios(ratios) {
  const ranked = Object.entries(ratios).sort((first, second) => second[1] - first[1]);
  if (!ranked.length || ranked[0][1] <= 0.008) return "";
  const [topChoice, topRatio] = ranked[0];
  const secondRatio = ranked[1]?.[1] || 0;
  if (topRatio >= 0.015 && topRatio - secondRatio >= 0.006 && topRatio >= secondRatio * 1.45) {
    return topChoice;
  }
  return "Needs Review";
}

export function detectExclusiveGroup(photoCanvas, blankCanvas, choices) {
  const details = Object.fromEntries(
    Object.entries(choices).map(([value, region]) => [value, detectMark(photoCanvas, blankCanvas, region)]),
  );
  return {
    value: chooseExclusiveFromRatios(Object.fromEntries(
      Object.entries(details).map(([value, result]) => [value, result.ratio]),
    )),
    details,
  };
}
