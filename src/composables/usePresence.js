import { ref, computed, readonly, onUnmounted } from 'vue'
import { useWebSocket } from './useWebSocket'
import { useSession } from './useSession'

// Module-level state
const participants = ref([])
const remoteCursors = ref(new Map())

export function usePresence() {
  const { isConnected, send, on } = useWebSocket()
  const { localParticipant } = useSession()

  let unsubscribers = []

  // Computed
  const otherParticipants = computed(() => {
    return participants.value.filter(p => p.id !== localParticipant.value?.id)
  })

  const participantCount = computed(() => participants.value.length)

  const cursors = computed(() => {
    return Array.from(remoteCursors.value.entries()).map(([id, cursor]) => {
      const participant = participants.value.find(p => p.id === id)
      return {
        participantId: id,
        ...cursor,
        displayName: participant?.displayName || 'Anonymous',
        color: participant?.color || '#888888'
      }
    })
  })

  /**
   * Initialize presence tracking
   */
  function init() {
    // Handle participants list
    unsubscribers.push(on('participants:list', (payload) => {
      participants.value = payload.participants || []
    }))

    // Handle participant joined
    unsubscribers.push(on('participant:joined', (payload) => {
      const existing = participants.value.find(p => p.id === payload.id)
      if (!existing) {
        participants.value = [...participants.value, payload]
      }
    }))

    // Handle participant left
    unsubscribers.push(on('participant:left', (payload) => {
      participants.value = participants.value.filter(p => p.id !== payload.participantId)
      remoteCursors.value.delete(payload.participantId)
    }))

    // Handle cursor updates
    unsubscribers.push(on('cursor:update', (payload) => {
      const { participantId, cursor } = payload
      if (participantId !== localParticipant.value?.id) {
        remoteCursors.value.set(participantId, cursor)
      }
    }))

    // Handle participant viewport updates (for page indicators)
    unsubscribers.push(on('participant:viewport', (payload) => {
      const { participantId, pageIndex } = payload
      const participant = participants.value.find(p => p.id === participantId)
      if (participant) {
        participant.pageIndex = pageIndex
        // Trigger reactivity
        participants.value = [...participants.value]
      }
    }))
  }

  /**
   * Cleanup presence tracking
   */
  function cleanup() {
    unsubscribers.forEach(unsub => unsub())
    unsubscribers = []
    participants.value = []
    remoteCursors.value.clear()
  }

  /**
   * Update local cursor position
   */
  function updateCursor(x, y, pageIndex = 0) {
    if (!isConnected.value) return

    send('cursor:move', {
      x,
      y,
      pageIndex
    })
  }

  /**
   * Throttled cursor update (call this from mousemove)
   */
  let lastCursorUpdate = 0
  const CURSOR_THROTTLE = 50 // ms

  function throttledCursorUpdate(x, y, pageIndex = 0) {
    const now = Date.now()
    if (now - lastCursorUpdate >= CURSOR_THROTTLE) {
      lastCursorUpdate = now
      updateCursor(x, y, pageIndex)
    }
  }

  /**
   * Get participant by ID
   */
  function getParticipant(id) {
    return participants.value.find(p => p.id === id) || null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    participants: readonly(participants),
    otherParticipants,
    participantCount,
    cursors,
    localParticipant,

    // Actions
    init,
    cleanup,
    updateCursor,
    throttledCursorUpdate,
    getParticipant
  }
}
