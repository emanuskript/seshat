import { createApp } from "vue";
import App from "./App.vue";
import router from "./router"; // Import the router

// Tailwind CSS and global styles
import './assets/styles/globals.css';

// Ensure every runtime origin points to the Hugging Face backend.
const HF_BACKEND = 'https://basuony-pharosight.hf.space';

if (typeof window !== 'undefined') {
  // Expose the canonical backend for any legacy scripts.
  window.__PHAROSIGHT_API_BASE__ = HF_BACKEND;
  try {
    const key = 'pharosight.backend.url';
    const cached = window.localStorage?.getItem(key);
    if (!cached || /pharosight\.onrender\.com/i.test(cached)) {
      window.localStorage?.setItem(key, HF_BACKEND);
    }
  } catch (err) {
    console.warn('Backend URL cache not writable:', err);
  }

  const normalizeEndpoint = (value) => {
    if (!value) return value;
    if (typeof value === 'string' && /pharosight\.onrender\.com/i.test(value)) {
      return value.replace(/https?:\/\/pharosight\.onrender\.com/gi, HF_BACKEND);
    }
    return value;
  };

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (typeof input === 'string') {
        input = normalizeEndpoint(input);
      }
      return originalFetch(input, init);
    };
  }

  if (typeof window.XMLHttpRequest !== 'undefined') {
    const OriginalXHR = window.XMLHttpRequest;
    const patchedOpen = OriginalXHR.prototype.open;
    OriginalXHR.prototype.open = function patched(method, url, ...rest) {
      const normalized = normalizeEndpoint(url);
      return patchedOpen.call(this, method, normalized, ...rest);
    };
  }
}

createApp(App).use(router).mount("#app");
