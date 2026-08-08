import { cropCanvas, extraInkRatio } from "./markDetector.js";

const WHITELISTS = {
  number: "0123456789",
  date: "0123456789/-.",
  phone: "0123456789+-() ",
  email: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@._-+",
  money: "0123456789.,",
  id: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-",
};

function cleanText(text, type) {
  let value = text.replace(/[|]/g, "").replace(/\s+/g, " ").trim();
  if (["number", "date", "phone", "money", "id"].includes(type)) value = value.replace(/\s/g, "");
  if (type === "money") value = value.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  return value;
}

export function preprocessCrop(source, region) {
  const original = cropCanvas(source, region);
  const output = document.createElement("canvas");
  output.width = original.width * 2;
  output.height = original.height * 2;
  const context = output.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.drawImage(original, 0, 0, output.width, output.height);
  const image = context.getImageData(0, 0, output.width, output.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const adjusted = gray > 218 ? 255 : Math.max(0, Math.min(255, (gray - 55) * 1.55));
    image.data[i] = adjusted;
    image.data[i + 1] = adjusted;
    image.data[i + 2] = adjusted;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
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
        debug.push({ page, label: `${label}${regions.length > 1 ? ` line ${index + 1}` : ""}`, region, result: "", confidence: 100, inkRatio, skippedAsBlank: true });
        continue;
      }
      const crop = preprocessCrop(photoCanvas, region);
      await this.worker.setParameters({
        tessedit_pageseg_mode: String(spec.psm || 7),
        tessedit_char_whitelist: WHITELISTS[spec.type] || "",
        preserve_interword_spaces: "1",
      });
      const recognition = await this.worker.recognize(crop);
      const value = cleanText(recognition.data.text || "", spec.type);
      lines.push(value);
      confidences.push(Number(recognition.data.confidence || 0));
      debug.push({
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
