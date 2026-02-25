// src/composables/useSession.js
import { ref, computed } from 'vue'
import { sessionsApi } from '../services/api'

function uuidv4() {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : null

  const bytes = new Uint8Array(16)
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    // Very old/locked-down environments fallback (still produces correct UUID shape)
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  // RFC 4122 v4 + variant
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function useSession() {
  const sessionId = ref(null)
  const sessionData = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const isInSession = computed(() => !!sessionId.value)

  // Build a shareable URL from the current session id
  const shareUrl = computed(() => {
    if (!sessionId.value) return ''
    const origin =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : ''
    return `${origin}/session/${sessionId.value}`
  })

  const getDeviceId = () => {
    const key = 'quillapp_device_id'
    let deviceId = localStorage.getItem(key)
    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem(key, deviceId)
    }
    return deviceId
  }

  const getParticipantId = () => {
    const key = 'quillapp_participant_id'
    let participantId = localStorage.getItem(key)
    if (!participantId) {
      participantId = uuidv4()
      localStorage.setItem(key, participantId)
    }
    return participantId
  }

  const createSession = async (iiifManifest, documentName, annotations) => {
    try {
      isLoading.value = true
      error.value = null

      const deviceId = getDeviceId()
      const participantId = getParticipantId()

      const response = await sessionsApi.createSession({
        iiifManifest,
        documentName,
        annotations: annotations || {},
        deviceId,
        participantId,
        metadata: {
          createdAt: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      })

      sessionId.value = response.id
      sessionData.value = response

      return response
    } catch (err) {
      error.value = err
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const joinSession = async (id, displayName) => {
    try {
      isLoading.value = true
      error.value = null

      const deviceId = getDeviceId()
      const participantId = getParticipantId()

      const response = await sessionsApi.joinSession(id, {
        deviceId,
        participantId,
        displayName: displayName || undefined,
        metadata: {
          joinedAt: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      })

      sessionId.value = id
      sessionData.value = response

      return response
    } catch (err) {
      error.value = err
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const leaveSession = async () => {
    sessionId.value = null
    sessionData.value = null
    error.value = null
  }

  const updateAnnotations = async (annotations) => {
    if (!sessionId.value) throw new Error('Not in a session')

    try {
      const deviceId = getDeviceId()
      await sessionsApi.updateAnnotations(sessionId.value, {
        deviceId,
        annotations
      })
    } catch (err) {
      error.value = err
      throw err
    }
  }

  const fetchSession = async (id) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await sessionsApi.getSession(id)
      sessionData.value = response
      return response
    } catch (err) {
      error.value = err
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    sessionId,
    sessionData,
    isLoading,
    error,
    isInSession,
    shareUrl,
    createSession,
    joinSession,
    leaveSession,
    updateAnnotations,
    fetchSession
  }
}
