import { APP_CONFIG } from "../config/app-config.js";

const DB_NAME = "registration-form-scanner";
const STORE_NAME = "temporary-images";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveScan(data) {
  sessionStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(data));
}

export function loadScan() {
  const raw = sessionStorage.getItem(APP_CONFIG.storageKey);
  return raw ? JSON.parse(raw) : null;
}

export async function saveTemporaryImage(key, dataUrl) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadTemporaryImage(key) {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

export async function clearTemporaryData() {
  sessionStorage.removeItem(APP_CONFIG.storageKey);
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
