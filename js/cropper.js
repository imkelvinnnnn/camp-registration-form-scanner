const dialog = document.querySelector("#crop-dialog");
const canvas = document.querySelector("#crop-canvas");
const context = canvas.getContext("2d");
const stepLabel = document.querySelector("#crop-step");
const title = document.querySelector("#crop-title");
const message = document.querySelector("#crop-message");
const cancelButton = document.querySelector("#crop-cancel");
const resetButton = document.querySelector("#crop-reset");
const backButton = document.querySelector("#crop-back");
const nextButton = document.querySelector("#crop-next");

const INITIAL_CORNERS = Object.freeze([
  { x: 0.04, y: 0.04 },
  { x: 0.96, y: 0.04 },
  { x: 0.96, y: 0.96 },
  { x: 0.04, y: 0.96 },
]);

let session = null;
let draggedCorner = -1;

function cloneInitialCorners() {
  return INITIAL_CORNERS.map((point) => ({ ...point }));
}

function loadFileImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("A selected photo could not be opened for cropping."));
    };
    image.src = url;
  });
}

function canvasPoint(point) {
  return { x: point.x * canvas.width, y: point.y * canvas.height };
}

function draw() {
  if (!session) return;
  const image = session.images[session.pageIndex].image;
  const corners = session.corners[session.pageIndex];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const points = corners.map(canvasPoint);
  context.save();
  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = "rgba(5, 18, 15, 0.55)";
  context.fill("evenodd");

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.lineWidth = Math.max(3, canvas.width / 300);
  context.strokeStyle = "#3ee39f";
  context.stroke();

  const displayWidth = Math.max(1, canvas.getBoundingClientRect().width);
  const radius = 15 * (canvas.width / displayWidth);
  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.lineWidth = Math.max(3, radius * 0.22);
    context.strokeStyle = "#157552";
    context.stroke();
    context.fillStyle = "#153d31";
    context.font = `800 ${Math.max(11, radius)}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(index + 1), point.x, point.y);
  });
  context.restore();
}

function showPage(index) {
  session.pageIndex = index;
  const image = session.images[index].image;
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  stepLabel.textContent = `Page ${index + 1} of 2`;
  title.textContent = `Set the four corners for Page ${index + 1}`;
  message.textContent = "Drag handles 1–4 onto the four corners of the paper. Keep only the form inside the green outline.";
  message.classList.remove("crop-error");
  backButton.hidden = index === 0;
  nextButton.textContent = index === 0 ? "Next: Crop Page 2" : "Use These Crops";
  draw();
}

function pointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    hitRadius: 34 * canvas.width / bounds.width,
  };
}

function nearestCorner(position) {
  const points = session.corners[session.pageIndex].map(canvasPoint);
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.hypot(position.x - point.x, position.y - point.y);
    if (distance < nearestDistance && distance <= position.hitRadius) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}

function isValidQuadrilateral(corners) {
  const area = Math.abs(corners.reduce((sum, point, index) => {
    const next = corners[(index + 1) % corners.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
  if (area < 0.12) return false;

  let direction = 0;
  for (let index = 0; index < corners.length; index += 1) {
    const first = corners[index];
    const second = corners[(index + 1) % corners.length];
    const third = corners[(index + 2) % corners.length];
    const cross = (second.x - first.x) * (third.y - second.y) - (second.y - first.y) * (third.x - second.x);
    if (Math.abs(cross) < 0.0001) return false;
    const currentDirection = Math.sign(cross);
    if (direction && currentDirection !== direction) return false;
    direction = currentDirection;
  }
  return true;
}

function finish(value) {
  const activeSession = session;
  if (!activeSession) return;
  session = null;
  draggedCorner = -1;
  activeSession.images.forEach(({ url }) => URL.revokeObjectURL(url));
  if (dialog.open) dialog.close();
  activeSession.resolve(value);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!session) return;
  const position = pointerPosition(event);
  draggedCorner = nearestCorner(position);
  if (draggedCorner >= 0) {
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!session || draggedCorner < 0) return;
  const position = pointerPosition(event);
  session.corners[session.pageIndex][draggedCorner] = {
    x: Math.max(0, Math.min(1, position.x / canvas.width)),
    y: Math.max(0, Math.min(1, position.y / canvas.height)),
  };
  draw();
  event.preventDefault();
});

const releasePointer = () => { draggedCorner = -1; };
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

resetButton.addEventListener("click", () => {
  session.corners[session.pageIndex] = cloneInitialCorners();
  draw();
});
backButton.addEventListener("click", () => showPage(0));
cancelButton.addEventListener("click", () => finish(null));
nextButton.addEventListener("click", () => {
  if (!isValidQuadrilateral(session.corners[session.pageIndex])) {
    message.textContent = "The corner lines cross or the selected area is too small. Place handles 1–4 around the paper in order.";
    message.classList.add("crop-error");
    return;
  }
  if (session.pageIndex === 0) {
    showPage(1);
  } else {
    finish(session.corners.map((corners) => corners.map((point) => ({ ...point }))));
  }
});

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  finish(null);
});
window.addEventListener("resize", draw);

export async function requestPageCorners(files) {
  if (session) throw new Error("The crop editor is already open.");
  const images = await Promise.all(files.map(loadFileImage));
  return new Promise((resolve) => {
    session = {
      images,
      corners: [cloneInitialCorners(), cloneInitialCorners()],
      pageIndex: 0,
      resolve,
    };
    dialog.showModal();
    showPage(0);
  });
}
