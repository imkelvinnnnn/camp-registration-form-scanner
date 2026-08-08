import { APP_CONFIG, APPS_SCRIPT_CONFIGURED } from "../config/app-config.js";

export async function submitToGoogleSheets(data) {
  if (!APPS_SCRIPT_CONFIGURED) {
    throw new Error("Google Sheets is not configured yet. Add your Apps Script Web App URL in config/app-config.js.");
  }
  let response;
  try {
    response = await fetch(APP_CONFIG.appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Could not connect to Google Sheets. Check the Apps Script deployment URL and internet connection.");
  }
  if (!response.ok) throw new Error(`Google Sheets returned an error (${response.status}).`);
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Google Sheets returned an unexpected response. Check the Apps Script deployment settings.");
  }
  if (!result.ok) throw new Error(result.error || "Google Sheets could not save the registration.");
  return result;
}
