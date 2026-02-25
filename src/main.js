import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

// Global styles – Tailwind v4, CSS custom-properties, theme classes
import "./assets/styles/globals.css";

// ---- crypto.randomUUID polyfill (HTTP on VM often lacks randomUUID) ----
function uuidv4Fallback() {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : null;

  // Prefer cryptographically-strong randomness when available
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
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
  if (typeof window !== "undefined" && window.crypto) {
    if (typeof window.crypto.randomUUID !== "function") {
      window.crypto.randomUUID = uuidv4Fallback;
    }
  }
} catch (_) {
  // ignore
}

createApp(App).use(router).mount("#app");
