// ---- UUID polyfill (fixes "crypto.randomUUID is not a function" on HTTP / older envs)
function uuidv4Fallback() {
  // Prefer crypto.getRandomValues when available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = uuidv4Fallback;
}

// ---- existing app boot
import { createApp } from 'vue';
import App from './App.vue';

const HF_BACKEND = 'https://basuony-pharosight.hf.space';

function normalizeUrl(url) {
  if (!url) return url;

  if (url.startsWith('/ml/')) {
    return HF_BACKEND + url.replace('/ml', '');
  }

  if (url.includes('/ml/')) {
    return url.replace(/https?:\/\/[^/]+\/ml/, HF_BACKEND);
  }

  if (url.includes('pharosight.onrender.com')) {
    return url.replace(/https?:\/\/pharosight\.onrender\.com/, HF_BACKEND);
  }

  return url;
}

const originalFetch = window.fetch;
window.fetch = function(url, options) {
  const normalizedUrl = normalizeUrl(url);
  return originalFetch(normalizedUrl, options);
};

const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  const normalizedUrl = normalizeUrl(url);
  return originalXHROpen.call(this, method, normalizedUrl, async, user, password);
};

createApp(App).mount('#app');
