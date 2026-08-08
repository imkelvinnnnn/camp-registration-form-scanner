export const APP_CONFIG = Object.freeze({
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwxYz1ZjM-GVPeoUQBSOvC1yj8BrapWA_zvcW7Z9HBPiWfJEPY4d3lWZElmOQ4qUDbp/exec",
  ocrLanguages: "chi_sim+eng",
  maxPhotoSide: 1800,
  debugQueryParameter: "debug",
  storageKey: "registration-form-scan-v1",
});

export const APPS_SCRIPT_CONFIGURED =
  APP_CONFIG.appsScriptUrl.startsWith("https://script.google.com/macros/s/");
