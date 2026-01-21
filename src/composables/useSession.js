import { ref, computed, readonly, onUnmounted } from 'vue'
import { sessionsApi } from '@/services/api'
import { useWebSocket } from './useWebSocket'

const DEVICE_ID_KEY = 'quillapp-device-id'

// Module-level state (singleton pattern)
const currentSession = ref(null)
const isLoading = ref(false)
const isSyncing = ref(false)
const error = ref(null)
const localParticipant = ref(null)

// Get or create device ID for "My Projects"
function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function useSession() {
  const { isConnected, connect, disconnect, send, on } = useWebSocket()

  // Computed
  const sessionId = computed(() => currentSession.value?.id || null)
  const annotations = computed(() => currentSession.value?.annotations || {})
  const shareUrl = computed(() => {
    if (!sessionId.value) return null
    const base = window.location.origin
    return `${base}/session/${sessionId.value}`
  })

  // Message handlers
  let unsubscribers = []

  function setupMessageHandlers() {
    // Handle join confirmation
    unsubscribers.push(on('joined', (payload) => {
      localParticipant.value = {
        id: payload.participantId,
        displayName: payload.displayName,
        color: payload.color
      }
    }))

    // Handle annotation sync from other participants
    unsubscribers.push(on('annotation:sync', (payload) => {
      if (!currentSession.value) return

      const { action, annotationType, annotation, annotationId, updates, participantId } = payload

      // Skip if this is our own change (we already applied it locally)
      if (participantId === localParticipant.value?.id) return

      const annotations = { ...currentSession.value.annotations }

      switch (action) {
        case 'add':
          if (!annotations[annotationType]) {
            annotations[annotationType] = []
          }
          annotations[annotationType].push(annotation)
          break

        case 'update':
          if (annotations[annotationType]) {
            const index = annotations[annotationType].findIndex(a => a.id === annotationId)
            if (index !== -1) {
              annotations[annotationType][index] = {
                ...annotations[annotationType][index],
                ...updates
              }
            }
          }
          break

        case 'delete':
          if (annotations[annotationType]) {
            annotations[annotationType] = annotations[annotationType].filter(a => a.id !== annotationId)
          }
          break
      }

      currentSession.value = {
        ...currentSession.value,
        annotations
      }
    }))

    // Handle version restored (from another participant)
    unsubscribers.push(on('version:restored', (payload) => {
      if (!currentSession.value) return

      const { annotations } = payload

      // Update local session with restored annotations
      currentSession.value = {
        ...currentSession.value,
        annotations
      }
    }))

    // Handle errors
    unsubscribers.push(on('error', (payload) => {
      console.error('Session error:', payload.message)
      error.value = payload.message
    }))
  }

  function cleanupMessageHandlers() {
    unsubscribers.forEach(unsub => unsub())
    unsubscribers = []
  }

  /**
   * Create a new session
   */
  async function createSession(iiifManifest, documentName, initialAnnotations = {}) {
    isLoading.value = true
    error.value = null

    try {
      const session = await sessionsApi.create({
        iiifManifest,
        documentName,
        annotations: initialAnnotations,
        deviceId: getDeviceId()
      })

      currentSession.value = session
      return session
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get or create a participant ID for this session (stored per tab)
   */
  function getParticipantId(sessionId) {
    const key = `quillapp-participant-${sessionId}`
    let participantId = sessionStorage.getItem(key)
    if (!participantId) {
      participantId = crypto.randomUUID()
      sessionStorage.setItem(key, participantId)
    }
    return participantId
  }

  /**
   * Join an existing session
   */
  async function joinSession(id, displayName = 'Anonymous') {
    isLoading.value = true
    error.value = null

    try {
      // Fetch session data
      const session = await sessionsApi.get(id)
      currentSession.value = session

      // Connect to WebSocket for real-time sync
      await connect()

      // Setup message handlers
      setupMessageHandlers()

      // Get consistent participant ID for this session (per tab)
      const participantId = getParticipantId(id)

      // Send join message with participant ID
      send('join', {
        sessionId: id,
        displayName,
        participantId
      })

      return session
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Leave the current session
   */
  function leaveSession() {
    cleanupMessageHandlers()
    disconnect()
    currentSession.value = null
    localParticipant.value = null
  }

  /**
   * Add an annotation (syncs to other participants)
   */
  function addAnnotation(annotationType, annotation) {
    if (!currentSession.value) return

    // Apply locally first
    const annotations = { ...currentSession.value.annotations }
    if (!annotations[annotationType]) {
      annotations[annotationType] = []
    }
    annotations[annotationType].push(annotation)

    currentSession.value = {
      ...currentSession.value,
      annotations
    }

    // Sync to others via WebSocket
    if (isConnected.value) {
      send('annotation:add', {
        annotationType,
        annotation
      })
    }
  }

  /**
   * Update an annotation (syncs to other participants)
   */
  function updateAnnotation(annotationType, annotationId, updates) {
    if (!currentSession.value) return

    // Apply locally first
    const annotations = { ...currentSession.value.annotations }
    if (annotations[annotationType]) {
      const index = annotations[annotationType].findIndex(a => a.id === annotationId)
      if (index !== -1) {
        annotations[annotationType][index] = {
          ...annotations[annotationType][index],
          ...updates
        }

        currentSession.value = {
          ...currentSession.value,
          annotations
        }
      }
    }

    // Sync to others via WebSocket
    if (isConnected.value) {
      send('annotation:update', {
        annotationType,
        annotationId,
        updates
      })
    }
  }

  /**
   * Delete an annotation (syncs to other participants)
   */
  function deleteAnnotation(annotationType, annotationId) {
    if (!currentSession.value) return

    // Apply locally first
    const annotations = { ...currentSession.value.annotations }
    if (annotations[annotationType]) {
      annotations[annotationType] = annotations[annotationType].filter(a => a.id !== annotationId)

      currentSession.value = {
        ...currentSession.value,
        annotations
      }
    }

    // Sync to others via WebSocket
    if (isConnected.value) {
      send('annotation:delete', {
        annotationType,
        annotationId
      })
    }
  }

  /**
   * Save annotations to server (for offline/manual save)
   */
  async function saveAnnotations() {
    if (!currentSession.value) return

    isSyncing.value = true
    error.value = null

    try {
      await sessionsApi.updateAnnotations(
        currentSession.value.id,
        currentSession.value.annotations
      )
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Get user's projects (by device ID)
   */
  async function getMyProjects() {
    try {
      const result = await sessionsApi.getByDevice(getDeviceId())
      return result.sessions || []
    } catch (err) {
      console.error('Failed to get projects:', err)
      return []
    }
  }

  /**
   * Delete a session
   */
  async function deleteSession(id) {
    await sessionsApi.delete(id)
    if (currentSession.value?.id === id) {
      leaveSession()
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupMessageHandlers()
  })

  return {
    // State
    currentSession: readonly(currentSession),
    sessionId,
    annotations,
    shareUrl,
    isLoading: readonly(isLoading),
    isSyncing: readonly(isSyncing),
    isConnected,
    error: readonly(error),
    localParticipant: readonly(localParticipant),

    // Actions
    createSession,
    joinSession,
    leaveSession,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    saveAnnotations,
    getMyProjects,
    deleteSession,
    getDeviceId,

    // Event subscription (for components to receive remote changes)
    onMessage: on
  }
}
