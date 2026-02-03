import { ref, readonly } from 'vue'

const WS_URL = process.env.VUE_APP_WS_URL || 'ws://localhost:3001'

// Module-level state (singleton pattern)
let socket = null
const isConnected = ref(false)
const isConnecting = ref(false)
const error = ref(null)

// Message handlers by type
const messageHandlers = new Map()

// Reconnection settings
const RECONNECT_DELAY = 2000
const MAX_RECONNECT_ATTEMPTS = 5
let reconnectAttempts = 0
let reconnectTimeout = null

// Ping interval
const PING_INTERVAL = 25000
let pingInterval = null

export function useWebSocket() {
  /**
   * Connect to WebSocket server
   */
  function connect() {
    if (socket?.readyState === WebSocket.OPEN || isConnecting.value) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      isConnecting.value = true
      error.value = null

      socket = new WebSocket(`${WS_URL}/ws`)

      socket.onopen = () => {
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts = 0
        error.value = null

        // Start ping interval
        startPing()

        resolve()
      }

      socket.onclose = (event) => {
        isConnected.value = false
        isConnecting.value = false
        stopPing()

        // Attempt reconnection if not a clean close
        if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect()
        }
      }

      socket.onerror = (err) => {
        isConnecting.value = false
        error.value = 'Connection failed'
        reject(err)
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e)
        }
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect() {
    stopPing()
    clearReconnect()

    if (socket) {
      socket.close(1000, 'Client disconnect')
      socket = null
    }

    isConnected.value = false
    isConnecting.value = false
  }

  /**
   * Send a message through the WebSocket
   */
  function send(type, payload = {}) {
    if (socket?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }

    try {
      socket.send(JSON.stringify({ type, payload }))
      return true
    } catch (e) {
      console.error('Failed to send WebSocket message:', e)
      return false
    }
  }

  /**
   * Register a handler for a specific message type
   */
  function on(type, handler) {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, new Set())
    }
    messageHandlers.get(type).add(handler)

    // Return unsubscribe function
    return () => {
      messageHandlers.get(type)?.delete(handler)
    }
  }

  /**
   * Remove a handler for a specific message type
   */
  function off(type, handler) {
    messageHandlers.get(type)?.delete(handler)
  }

  /**
   * Handle incoming messages
   */
  function handleMessage(message) {
    const { type, payload } = message
    const handlers = messageHandlers.get(type)

    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (e) {
          console.error(`Error in message handler for ${type}:`, e)
        }
      })
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  function startPing() {
    stopPing()
    pingInterval = setInterval(() => {
      send('ping')
    }, PING_INTERVAL)
  }

  /**
   * Stop ping interval
   */
  function stopPing() {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }

  /**
   * Schedule reconnection attempt
   */
  function scheduleReconnect() {
    clearReconnect()
    reconnectAttempts++

    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1)
    console.log(`Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`)

    reconnectTimeout = setTimeout(() => {
      connect().catch(() => {
        // Will schedule another reconnect on failure
      })
    }, delay)
  }

  /**
   * Clear pending reconnection
   */
  function clearReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  return {
    // State
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    error: readonly(error),

    // Actions
    connect,
    disconnect,
    send,
    on,
    off
  }
}
