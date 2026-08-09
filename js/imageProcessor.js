import { APP_CONFIG } from "../config/app-config.js";

const imageCache = new Map();

export function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Reference template could not be loaded: ${url}`));
    image.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

function bitmapToCanvas(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export async function normalizePagesInWorker(page1File, page2File, pageCorners, onProgress = () => {}, timeoutMs = 180000) {
  if (!window.Worker || !window.createImageBitmap) {
    throw new Error("This browser is too old for background image processing. Please use a current version of Chrome, Edge, Firefox, or Safari.");
  }

  const worker = new Worker(new URL("./opencv-worker.js", import.meta.url));
  const [page1Buffer, page2Buffer] = await Promise.all([
    page1File.arrayBuffer(),
    page2File.arrayBuffer(),
  ]);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error("Image processing took too long. Please reload and try smaller or clearer photos."));
    }, timeoutMs);

    worker.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "progress") {
        onProgress({ percent: message.percent, label: message.label });
        return;
      }
      if (message.type === "complete") {
        try {
          finish(resolve, {
            page1Canvas: bitmapToCanvas(message.page1Bitmap),
            page2Canvas: bitmapToCanvas(message.page2Bitmap),
            layoutScores: message.layoutScores,
          });
        } catch (error) {
          finish(reject, error);
        }
        return;
      }
      if (message.type === "error") {
        finish(reject, new Error(message.message || "The photos could not be processed."));
      }
    });

    worker.addEventListener("error", (event) => {
      finish(reject, new Error(event.message || "The background image processor stopped unexpectedly."));
    });

    worker.postMessage({
      type: "process-pages",
      maxPhotoSide: APP_CONFIG.maxPhotoSide,
      pages: [
        { page: 1, buffer: page1Buffer, mimeType: page1File.type || "image/jpeg", corners: pageCorners?.[0] },
        { page: 2, buffer: page2Buffer, mimeType: page2File.type || "image/jpeg", corners: pageCorners?.[1] },
      ],
    }, [page1Buffer, page2Buffer]);
  });
}

export function canvasFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error("A temporary normalized image could not be reopened."));
    image.src = dataUrl;
  });
}
