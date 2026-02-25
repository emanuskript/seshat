import { ref, onBeforeUnmount } from "vue";

// Accepts:
// - ws://host
// - ws://host/ws
// - http://host   (auto-converts to ws://)
// - https://host  (auto-converts to wss://)
function normalizeWsBase(raw) {
  let u = (raw || "").trim();
  if (!u) u = "ws://localhost:3001";

  u = u.replace(/\/+$/, "");     // drop trailing slashes
  u = u.replace(/\/ws$/, "");    // drop trailing /ws if provided

  if (u.startsWith("http://")) u = "ws://" + u.slice("http://".length);
  if (u.startsWith("https://")) u = "wss://" + u.slice("https://".length);

  return u;
}

export function useWebSocket(sessionId, onMessage) {
  const WS_URL_RAW = process.env.VUE_APP_WS_URL || "ws://localhost:3001";
  const WS_BASE = normalizeWsBase(WS_URL_RAW);

  const socket = ref(null);
  const isConnected = ref(false);
  const connectionError = ref(null);

  const connect = () => {
    return new Promise((resolve, reject) => {
      try {
        const url = `${WS_BASE}/ws?sessionId=${encodeURIComponent(sessionId)}`;
        socket.value = new WebSocket(url);

        socket.value.onopen = () => {
          isConnected.value = true;
          connectionError.value = null;
          resolve();
        };

        socket.value.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage?.(data);
          } catch (e) {
            // ignore malformed messages
          }
        };

        socket.value.onclose = () => {
          isConnected.value = false;
        };

        socket.value.onerror = (error) => {
          connectionError.value = error;
          isConnected.value = false;
          reject(error);
        };
      } catch (error) {
        connectionError.value = error;
        reject(error);
      }
    });
  };

  const send = (data) => {
    if (socket.value && isConnected.value) {
      socket.value.send(JSON.stringify(data));
    }
  };

  const disconnect = () => {
    if (socket.value) socket.value.close();
    socket.value = null;
    isConnected.value = false;
  };

  onBeforeUnmount(() => disconnect());

  return {
    socket,
    isConnected,
    connectionError,
    connect,
    send,
    disconnect,
  };
}
