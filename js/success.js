import { clearTemporaryData } from "./storage.js";

clearTemporaryData().catch(() => {
  // The submission already succeeded. Temporary browser data will expire with the session if cleanup is unavailable.
});
