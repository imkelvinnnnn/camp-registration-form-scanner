/* global cv, Module */

const TARGET_SIZE = Object.freeze({ width: 1440, height: 2048 });
const OPENCV_RUNTIME_URL = "./vendor/opencv-4.12.0.js";
const OPENCV_RUNTIME_SIZE = 10872779;
let openCvPromise = null;

function report(percent, label) {
  self.postMessage({ type: "progress", percent, label });
}

function errorMessage(error) {
  if (typeof error === "string") return error;
  return error?.message || "The background image processor stopped unexpectedly.";
}

function ensureOpenCv() {
  if (openCvPromise) return openCvPromise;
  openCvPromise = (async () => {
    const response = await fetch(new URL(OPENCV_RUNTIME_URL, self.location.href), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`The bundled OpenCV file could not be downloaded (HTTP ${response.status}).`);
    }
    const runtimeBytes = await response.arrayBuffer();
    if (runtimeBytes.byteLength !== OPENCV_RUNTIME_SIZE) {
      throw new Error(`The bundled OpenCV file is incomplete (${runtimeBytes.byteLength} of ${OPENCV_RUNTIME_SIZE} bytes). Extract the complete project ZIP again.`);
    }

    await new Promise((resolve, reject) => {
      let runtimeStarted = false;
      const timeout = setTimeout(() => reject(new Error("The bundled OpenCV engine could not start.")), 90000);
      const finish = (loaded) => {
        const engine = loaded?.Mat ? loaded : self.cv?.Mat ? self.cv : self.Module;
        if (!engine?.Mat) return;
        clearTimeout(timeout);
        self.cv = engine;
        resolve();
      };

      self.Module = {
        onRuntimeInitialized() {
          runtimeStarted = true;
          setTimeout(() => finish(self.cv), 0);
        },
      };

      const runtimeBlobUrl = URL.createObjectURL(new Blob([runtimeBytes], { type: "text/javascript" }));
      try {
        importScripts(runtimeBlobUrl);
        if (self.cv && typeof self.cv.then === "function") {
          self.cv.then(finish);
        } else if (self.cv?.Mat) {
          finish(self.cv);
        } else if (runtimeStarted) {
          setTimeout(() => finish(self.cv), 0);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`OpenCV could not be loaded from this project: ${errorMessage(error)}`));
      } finally {
        URL.revokeObjectURL(runtimeBlobUrl);
      }
    });
  })();
  return openCvPromise;
}

async function decodeBitmap(buffer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(blob);
  }
}

function bitmapToMat(engine, bitmap, maxSide) {
  const largest = Math.max(bitmap.width, bitmap.height);
  const scale = largest > maxSide ? maxSide / largest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return engine.matFromImageData(imageData);
}

function orderCorners(points) {
  const topLeft = points.reduce((a, b) => a.x + a.y < b.x + b.y ? a : b);
  const bottomRight = points.reduce((a, b) => a.x + a.y > b.x + b.y ? a : b);
  const topRight = points.reduce((a, b) => a.x - a.y > b.x - b.y ? a : b);
  const bottomLeft = points.reduce((a, b) => a.x - a.y < b.x - b.y ? a : b);
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function cornerDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function isPlausiblePageQuadrilateral(points, src, contourArea) {
  if (!points || new Set(points.map((point) => `${point.x},${point.y}`)).size !== 4) return false;
  const averageWidth = (cornerDistance(points[0], points[1]) + cornerDistance(points[3], points[2])) / 2;
  const averageHeight = (cornerDistance(points[0], points[3]) + cornerDistance(points[1], points[2])) / 2;
  const pageRatio = averageWidth / Math.max(1, averageHeight);
  const coverage = contourArea / (src.rows * src.cols);
  return coverage >= 0.5 && pageRatio >= 0.45 && pageRatio <= 0.95;
}

function findDocumentCorners(engine, src) {
  const gray = new engine.Mat();
  const blurred = new engine.Mat();
  const edges = new engine.Mat();
  const contours = new engine.MatVector();
  const hierarchy = new engine.Mat();
  let best = null;
  let bestArea = 0;

  try {
    engine.cvtColor(src, gray, engine.COLOR_RGBA2GRAY);
    engine.GaussianBlur(gray, blurred, new engine.Size(7, 7), 0);
    engine.Canny(blurred, edges, 45, 140);
    const kernel = engine.Mat.ones(3, 3, engine.CV_8U);
    engine.dilate(edges, edges, kernel);
    kernel.delete();
    engine.findContours(edges, contours, hierarchy, engine.RETR_LIST, engine.CHAIN_APPROX_SIMPLE);

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      try {
        const area = engine.contourArea(contour);
        if (area <= bestArea || area <= src.rows * src.cols * 0.5) continue;
        const perimeter = engine.arcLength(contour, true);
        const approximation = new engine.Mat();
        try {
          engine.approxPolyDP(contour, approximation, perimeter * 0.025, true);
          if (approximation.rows === 4 && engine.isContourConvex(approximation)) {
            const values = approximation.data32S;
            const ordered = orderCorners(Array.from({ length: 4 }, (_, point) => ({
              x: values[point * 2],
              y: values[point * 2 + 1],
            })));
            if (isPlausiblePageQuadrilateral(ordered, src, area)) {
              best = ordered;
              bestArea = area;
            }
          }
        } finally {
          approximation.delete();
        }
      } finally {
        contour.delete();
      }
    }
  } finally {
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
  return best;
}

function fullImageCorners(src) {
  return [
    { x: 0, y: 0 },
    { x: src.cols - 1, y: 0 },
    { x: src.cols - 1, y: src.rows - 1 },
    { x: 0, y: src.rows - 1 },
  ];
}

function normalizedManualCorners(points, src) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  if (!points.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null;
  return points.map((point) => ({
    x: Math.max(0, Math.min(src.cols - 1, point.x * (src.cols - 1))),
    y: Math.max(0, Math.min(src.rows - 1, point.y * (src.rows - 1))),
  }));
}

function normalizeMat(engine, src, selectedCorners) {
  const ratio = src.cols / src.rows;
  const expectedRatio = TARGET_SIZE.width / TARGET_SIZE.height;
  // A tightly cropped template or scanner export is already page-shaped. Running
  // contour detection on it can mistake the large student table for the page edge.
  let corners = normalizedManualCorners(selectedCorners, src);
  if (!corners) {
    corners = Math.abs(ratio - expectedRatio) <= 0.012
      ? fullImageCorners(src)
      : findDocumentCorners(engine, src);
  }
  if (!corners) {
    if (Math.abs(ratio - expectedRatio) > 0.18) {
      throw new Error("We could not clearly detect the form. Please retake the photo with all four page corners visible.");
    }
    corners = fullImageCorners(src);
  }

  const from = engine.matFromArray(4, 1, engine.CV_32FC2, corners.flatMap((point) => [point.x, point.y]));
  const to = engine.matFromArray(4, 1, engine.CV_32FC2, [
    0, 0,
    TARGET_SIZE.width - 1, 0,
    TARGET_SIZE.width - 1, TARGET_SIZE.height - 1,
    0, TARGET_SIZE.height - 1,
  ]);
  const transform = engine.getPerspectiveTransform(from, to);
  const output = new engine.Mat();
  try {
    engine.warpPerspective(
      src,
      output,
      transform,
      new engine.Size(TARGET_SIZE.width, TARGET_SIZE.height),
      engine.INTER_CUBIC,
      engine.BORDER_REPLICATE,
    );
    return output;
  } catch (error) {
    output.delete();
    throw error;
  } finally {
    from.delete();
    to.delete();
    transform.delete();
  }
}

function layoutMask(engine, rgbaMat) {
  const small = new engine.Mat();
  const gray = new engine.Mat();
  const mask = new engine.Mat();
  try {
    engine.resize(rgbaMat, small, new engine.Size(180, 256), 0, 0, engine.INTER_AREA);
    engine.cvtColor(small, gray, engine.COLOR_RGBA2GRAY);
    engine.adaptiveThreshold(gray, mask, 255, engine.ADAPTIVE_THRESH_GAUSSIAN_C, engine.THRESH_BINARY, 19, 8);
    return mask;
  } catch (error) {
    mask.delete();
    throw error;
  } finally {
    small.delete();
    gray.delete();
  }
}

function maskDifference(engine, first, second) {
  const difference = new engine.Mat();
  try {
    engine.absdiff(first, second, difference);
    return engine.mean(difference)[0];
  } finally {
    difference.delete();
  }
}

async function loadReferenceMask(engine, relativeUrl) {
  const response = await fetch(new URL(relativeUrl, self.location.href));
  if (!response.ok) throw new Error(`A blank page template could not be loaded (${response.status}).`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const mat = bitmapToMat(engine, bitmap, Number.POSITIVE_INFINITY);
    try {
      return layoutMask(engine, mat);
    } finally {
      mat.delete();
    }
  } finally {
    bitmap.close();
  }
}

function matToBitmap(mat) {
  const canvas = new OffscreenCanvas(mat.cols, mat.rows);
  const context = canvas.getContext("2d");
  const pixels = new Uint8ClampedArray(mat.data);
  context.putImageData(new ImageData(pixels, mat.cols, mat.rows), 0, 0);
  return canvas.transferToImageBitmap();
}

async function processPage(engine, page, progress, maxPhotoSide) {
  report(progress.decode, `Opening Page ${page.page} photo…`);
  const bitmap = await decodeBitmap(page.buffer, page.mimeType);
  let src;
  try {
    src = bitmapToMat(engine, bitmap, maxPhotoSide);
  } finally {
    bitmap.close();
  }
  try {
    report(progress.detect, `Detecting Page ${page.page} edges…`);
    const normalized = normalizeMat(engine, src, page.corners);
    report(progress.normalized, `Page ${page.page} straightened.`);
    return normalized;
  } finally {
    src.delete();
  }
}

async function processPages(pages, requestedMaxPhotoSide) {
  if (!Array.isArray(pages) || pages.length !== 2) {
    throw new Error("Exactly two page photos are required.");
  }
  const maxPhotoSide = Math.max(1200, Math.min(2600, Number(requestedMaxPhotoSide) || 1800));

  report(2, "Loading bundled OpenCV in the background…");
  await ensureOpenCv();
  const engine = self.cv;
  report(6, "OpenCV ready.");

  let page1;
  let page2;
  let page1Mask;
  let page2Mask;
  let reference1Mask;
  let reference2Mask;
  try {
    page1 = await processPage(engine, pages[0], { decode: 8, detect: 12, normalized: 17 }, maxPhotoSide);
    page2 = await processPage(engine, pages[1], { decode: 19, detect: 23, normalized: 28 }, maxPhotoSide);

    report(30, "Loading blank-page references…");
    [reference1Mask, reference2Mask] = await Promise.all([
      loadReferenceMask(engine, "../assets/templates/page1-reference.png"),
      loadReferenceMask(engine, "../assets/templates/page2-reference.png"),
    ]);
    report(32, "Checking page order…");
    page1Mask = layoutMask(engine, page1);
    page2Mask = layoutMask(engine, page2);
    const layoutScores = {
      page1: {
        expected: maskDifference(engine, page1Mask, reference1Mask),
        other: maskDifference(engine, page1Mask, reference2Mask),
      },
      page2: {
        expected: maskDifference(engine, page2Mask, reference2Mask),
        other: maskDifference(engine, page2Mask, reference1Mask),
      },
    };
    if (layoutScores.page1.other + 2 < layoutScores.page1.expected * 0.9) {
      throw new Error("The uploaded Page 1 photo looks like Page 2. Please check the page order.");
    }
    if (layoutScores.page2.other + 2 < layoutScores.page2.expected * 0.9) {
      throw new Error("The uploaded Page 2 photo looks like Page 1. Please check the page order.");
    }

    report(35, "Pages normalized. Starting text recognition…");
    const page1Bitmap = matToBitmap(page1);
    const page2Bitmap = matToBitmap(page2);
    self.postMessage({ type: "complete", page1Bitmap, page2Bitmap, layoutScores }, [page1Bitmap, page2Bitmap]);
  } finally {
    page1?.delete();
    page2?.delete();
    page1Mask?.delete();
    page2Mask?.delete();
    reference1Mask?.delete();
    reference2Mask?.delete();
  }
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "process-pages") return;
  try {
    await processPages(event.data.pages, event.data.maxPhotoSide);
  } catch (error) {
    self.postMessage({ type: "error", message: errorMessage(error) });
  }
});
