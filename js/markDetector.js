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

export function extraInkRatio(photoCanvas, blankCanvas, region) {
  const photo = cropCanvas(photoCanvas, region);
  const blank = cropCanvas(blankCanvas, region);
  const photoData = photo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, photo.width, photo.height).data;
  const blankData = blank.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, blank.width, blank.height).data;
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
  const ratio = extraInkRatio(photoCanvas, blankCanvas, region);
  if (ratio >= 0.014) return { state: "selected", ratio };
  if (ratio <= 0.0035) return { state: "not-selected", ratio };
  return { state: "needs-review", ratio };
}

export function detectExclusiveGroup(photoCanvas, blankCanvas, choices) {
  const details = Object.fromEntries(
    Object.entries(choices).map(([value, region]) => [value, detectMark(photoCanvas, blankCanvas, region)]),
  );
  const selected = Object.entries(details).filter(([, result]) => result.state === "selected").map(([value]) => value);
  const uncertain = Object.values(details).some((result) => result.state === "needs-review");
  return {
    value: selected.length === 1 ? selected[0] : selected.length > 1 || uncertain ? "Needs Review" : "",
    details,
  };
}
