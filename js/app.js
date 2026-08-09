import { nextPaint, normalizePagesInWorker } from "./imageProcessor.js";
import { requestPageCorners } from "./cropper.js";
import { extractForms } from "./extractor.js";
import { saveScan, saveTemporaryImage } from "./storage.js";

const form = document.querySelector("#upload-form");
const errorBox = document.querySelector("#upload-error");
const progressDialog = document.querySelector("#progress-dialog");
const progressBar = document.querySelector("#progress-bar");
const progressPercent = document.querySelector("#progress-percent");
const progressMessage = document.querySelector("#progress-message");
const processButton = document.querySelector("#process-button");

function setProgress(percent, message) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.value = safePercent;
  progressPercent.textContent = `${safePercent}%`;
  if (message) progressMessage.textContent = message;
}

function setupPreview(inputId, imageId, wrapperId) {
  const input = document.querySelector(`#${inputId}`);
  const image = document.querySelector(`#${imageId}`);
  const wrapper = document.querySelector(`#${wrapperId}`);
  let previousUrl = null;
  input.addEventListener("change", () => {
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    if (!input.files[0]) {
      wrapper.hidden = true;
      return;
    }
    previousUrl = URL.createObjectURL(input.files[0]);
    image.src = previousUrl;
    wrapper.hidden = false;
    errorBox.hidden = true;
  });
}

setupPreview("page1-file", "page1-preview", "page1-preview-wrap");
setupPreview("page2-file", "page2-preview", "page2-preview-wrap");

document.querySelectorAll("[data-change]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.change}`).click());
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const page1File = document.querySelector("#page1-file").files[0];
  const page2File = document.querySelector("#page2-file").files[0];
  if (!page1File || !page2File) {
    errorBox.textContent = "Please add both Page 1 and Page 2 photos before processing.";
    errorBox.hidden = false;
    return;
  }

  errorBox.hidden = true;
  processButton.disabled = true;
  try {
    const pageCorners = await requestPageCorners([page1File, page2File]);
    if (!pageCorners) {
      processButton.disabled = false;
      return;
    }
    progressDialog.showModal();
    setProgress(1, "Starting background image processor…");
    await nextPaint();
    const { page1Canvas, page2Canvas } = await normalizePagesInWorker(
      page1File,
      page2File,
      pageCorners,
      ({ percent, label }) => setProgress(percent ?? progressBar.value, label),
    );

    const [page1DataUrl, page2DataUrl] = [page1Canvas.toDataURL("image/jpeg", 0.9), page2Canvas.toDataURL("image/jpeg", 0.9)];
    await Promise.all([
      saveTemporaryImage("normalized-page-1", page1DataUrl),
      saveTemporaryImage("normalized-page-2", page2DataUrl),
    ]);

    const result = await extractForms(page1Canvas, page2Canvas, ({ percent, label }) => setProgress(percent ?? progressBar.value, label));
    saveScan(result);
    setProgress(100, "Ready for your review.");
    window.location.href = `verify.html${new URLSearchParams(window.location.search).get("debug") === "true" ? "?debug=true" : ""}`;
  } catch (error) {
    if (progressDialog.open) progressDialog.close();
    errorBox.textContent = error.message || "The form could not be processed. Please try clearer photos.";
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    processButton.disabled = false;
  }
});
