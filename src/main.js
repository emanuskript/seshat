import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

// ---- crypto.randomUUID polyfill (HTTP on VM often lacks randomUUID) ----
function uuidv4Fallback() {
  // Prefer cryptographically-strong randomness when available
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  // Last-resort fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

try {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID !== "function") {
      globalThis.crypto.randomUUID = uuidv4Fallback;
    }
  }
} catch (_) {
  // ignore
}

createApp(App).use(router).mount("#app");
