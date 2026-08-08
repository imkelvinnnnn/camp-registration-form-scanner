import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("loads OpenCV only inside the image worker", async () => {
  const [html, worker] = await Promise.all([
    read("index.html"),
    read("js/opencv-worker.js"),
  ]);
  assert.doesNotMatch(html, /opencv\.js/i);
  assert.match(worker, /OPENCV_RUNTIME_URL = "\.\/vendor\/opencv-4\.12\.0\.js"/);
  assert.match(worker, /runtimeBytes\.byteLength !== OPENCV_RUNTIME_SIZE/);
  assert.match(worker, /importScripts\(runtimeBlobUrl\)/);
  assert.match(worker, /process-pages/);
});

test("ships the OpenCV runtime with the static project", async () => {
  const runtimeUrl = new URL("../js/vendor/opencv-4.12.0.js", import.meta.url);
  const [details, bytes] = await Promise.all([stat(runtimeUrl), readFile(runtimeUrl)]);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  assert.equal(details.size, 10_872_779, "bundled OpenCV file is incomplete");
  assert.equal(checksum, "bd0c3e6448043de04f6a64a12cb7b759f78c3ab8f7c35c9f2e0f71c88bb17103");
});

test("sends both input buffers to the worker as transferables", async () => {
  const client = await read("js/imageProcessor.js");
  assert.match(client, /pages:\s*\[/);
  assert.match(client, /\[page1Buffer, page2Buffer\]/);
  assert.match(client, /page1Bitmap/);
  assert.match(client, /page2Bitmap/);
});

test("does not mistake an internal form table for the page boundary", async () => {
  const worker = await read("js/opencv-worker.js");
  assert.match(worker, /coverage >= 0\.5/);
  assert.match(worker, /Math\.abs\(ratio - expectedRatio\) <= 0\.012/);
  assert.match(worker, /fullImageCorners\(src\)/);
});
