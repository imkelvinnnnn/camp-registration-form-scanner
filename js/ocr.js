import { cropCanvas, extraInkRatio } from "./markDetector.js";

const WHITELISTS = {
  number: "0123456789",
  date: "0123456789/-.",
  phone: "0123456789+-() ",
  email: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@._-+",
  english: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '-.",
  money: "0123456789.,",
  id: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-",
};

function cleanText(text, type) {
  let value = text.replace(/[|]/g, "").replace(/\s+/g, " ").trim();
  if (["number", "date", "phone", "money", "id"].includes(type)) value = value.replace(/\s/g, "");
  if (type === "money") value = value.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  return value;
}

export function preprocessCrop(source, blankSource, region) {
  const original = cropCanvas(source, region);
  const blank = cropCanvas(blankSource, region);
  const originalData = original.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, original.width, original.height);
  const blankData = blank.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, blank.width, blank.height).data;
  const mask = document.createElement("canvas");
  mask.width = original.width;
  mask.height = original.height;
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  const maskImage = maskContext.createImageData(mask.width, mask.height);
  const radius = 3;
  const histogram = new Uint32Array(256);
  for (let index = 0; index < originalData.data.length; index += 4) {
    const gray = Math.max(0, Math.min(255, Math.round(originalData.data[index] * 0.299 + originalData.data[index + 1] * 0.587 + originalData.data[index + 2] * 0.114)));
    histogram[gray] += 1;
  }
  let median = 255;
  let counted = 0;
  const midpoint = original.width * original.height / 2;
  for (let value = 0; value < histogram.length; value += 1) {
    counted += histogram[value];
    if (counted >= midpoint) {
      median = value;
      break;
    }
  }
  const inkThreshold = Math.max(75, Math.min(175, median - 35));
  const integralWidth = blank.width + 1;
  const darkIntegral = new Uint32Array((blank.width + 1) * (blank.height + 1));
  for (let y = 1; y <= blank.height; y += 1) {
    let rowDark = 0;
    for (let x = 1; x <= blank.width; x += 1) {
      const sample = ((y - 1) * blank.width + x - 1) * 4;
      const blankGray = blankData[sample] * 0.299 + blankData[sample + 1] * 0.587 + blankData[sample + 2] * 0.114;
      rowDark += blankGray < 178 ? 1 : 0;
      darkIntegral[y * integralWidth + x] = darkIntegral[(y - 1) * integralWidth + x] + rowDark;
    }
  }
  for (let y = 0; y < original.height; y += 1) {
    for (let x = 0; x < original.width; x += 1) {
      const index = (y * original.width + x) * 4;
      const photoGray = originalData.data[index] * 0.299 + originalData.data[index + 1] * 0.587 + originalData.data[index + 2] * 0.114;
      const left = Math.max(0, x - radius);
      const top = Math.max(0, y - radius);
      const right = Math.min(blank.width - 1, x + radius);
      const bottom = Math.min(blank.height - 1, y + radius);
      const darkCount = darkIntegral[(bottom + 1) * integralWidth + right + 1]
        - darkIntegral[top * integralWidth + right + 1]
        - darkIntegral[(bottom + 1) * integralWidth + left]
        + darkIntegral[top * integralWidth + left];
      const isHandwriting = photoGray < inkThreshold && darkCount === 0;
      const value = isHandwriting ? 0 : 255;
      maskImage.data[index] = value;
      maskImage.data[index + 1] = value;
      maskImage.data[index + 2] = value;
      maskImage.data[index + 3] = 255;
    }
  }
  maskContext.putImageData(maskImage, 0, 0);
  const output = document.createElement("canvas");
  output.width = original.width * 3;
  output.height = original.height * 3;
  const context = output.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(mask, 0, 0, output.width, output.height);
  return output;
}

export class BrowserOcr {
  constructor(languages, onEngineProgress = () => {}) {
    this.languages = languages;
    this.onEngineProgress = onEngineProgress;
    this.worker = null;
  }

  async start() {
    if (!window.Tesseract) throw new Error("The OCR library could not be loaded. Check your internet connection and reload.");
    this.worker = await window.Tesseract.createWorker(this.languages, 1, {
      logger: (message) => this.onEngineProgress(message),
    });
  }

  async recognize(photoCanvas, blankCanvas, spec, label, page, debug) {
    const regions = spec.regions || [spec];
    const lines = [];
    const confidences = [];
    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index];
      const inkRatio = extraInkRatio(photoCanvas, blankCanvas, region);
      if (inkRatio < 0.0012) {
        debug.push({ kind: "ocr", page, label: `${label}${regions.length > 1 ? ` line ${index + 1}` : ""}`, region, result: "", confidence: 100, inkRatio, skippedAsBlank: true });
        continue;
      }
      const crop = preprocessCrop(photoCanvas, blankCanvas, region);
      await this.worker.setParameters({
        tessedit_pageseg_mode: String(spec.psm || 7),
        tessedit_char_whitelist: WHITELISTS[spec.type] || "",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      const recognition = await this.worker.recognize(crop);
      const value = cleanText(recognition.data.text || "", spec.type);
      lines.push(value);
      confidences.push(Number(recognition.data.confidence || 0));
      debug.push({
        kind: "ocr",
        page,
        label: `${label}${regions.length > 1 ? ` line ${index + 1}` : ""}`,
        region,
        result: value,
        confidence: Number(recognition.data.confidence || 0),
        inkRatio,
      });
    }
    return {
      text: lines.filter(Boolean).join(" ").trim(),
      confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 100,
    };
  }

  async stop() {
    if (this.worker) await this.worker.terminate();
    this.worker = null;
  }
}
