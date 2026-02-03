import { ref, computed, readonly } from 'vue'
import { useWebSocket } from './useWebSocket'
import { useSession } from './useSession'

// Module-level state (singleton pattern)
const followState = ref({})           // { [participantId]: targetId }
const followingId = ref(null)         // Who local user is following
const participantsViewports = ref({}) // { [participantId]: pageIndex }

// Throttle settings
const VIEWPORT_THROTTLE = 100   // ms
const FILTER_THROTTLE = 200     // ms

// Throttle state
let viewportThrottleTimeout = null
let filterThrottleTimeout = null
let pendingViewport = null
let pendingFilters = null

// Callback registries
const viewportSyncCallbacks = new Set()
const filtersSyncCallbacks = new Set()

// Unsubscribers for WebSocket handlers
let unsubscribers = []

export function useFollow() {
  const { send, on, isConnected } = useWebSocket()
  const { localParticipant } = useSession()

  // Computed properties
  const isFollowing = computed(() => followingId.value !== null)

  const followedParticipant = computed(() => followingId.value)

  const myFollowers = computed(() => {
    if (!localParticipant.value?.id) return []
    return Object.entries(followState.value)
      .filter(([, targetId]) => targetId === localParticipant.value.id)
      .map(([followerId]) => followerId)
  })

  const followersCount = computed(() => myFollowers.value.length)

  /**
   * Initialize follow mode - subscribe to WebSocket events
   */
  function init() {
    cleanup() // Clean up any existing subscriptions

    // Handle follow state updates
    unsubscribers.push(on('follow:state', (payload) => {
      followState.value = payload.followers || {}

      // Check if our follow target is still valid
      if (followingId.value && !followState.value[localParticipant.value?.id]) {
        // Server cleared our follow (target left)
        followingId.value = null
      }

      // Sync local state with server state
      if (localParticipant.value?.id) {
        const serverFollowing = followState.value[localParticipant.value.id]
        if (serverFollowing !== followingId.value) {
          followingId.value = serverFollowing || null
        }
      }
    }))

    // Handle viewport sync from followed user
    unsubscribers.push(on('viewport:sync', (payload) => {
      // Only process if we're following this participant
      if (followingId.value === payload.fromParticipantId) {
        viewportSyncCallbacks.forEach(cb => {
          try {
            cb(payload)
          } catch (e) {
            console.error('Error in viewport sync callback:', e)
          }
        })
      }
    }))

    // Handle filters sync from followed user
    unsubscribers.push(on('filters:sync', (payload) => {
      // Only process if we're following this participant
      if (followingId.value === payload.fromParticipantId) {
        filtersSyncCallbacks.forEach(cb => {
          try {
            cb(payload)
          } catch (e) {
            console.error('Error in filters sync callback:', e)
          }
        })
      }
    }))

    // Handle participant viewport updates (for page indicators)
    unsubscribers.push(on('participant:viewport', (payload) => {
      const { participantId, pageIndex } = payload
      participantsViewports.value = {
        ...participantsViewports.value,
        [participantId]: pageIndex
      }
    }))

    // Handle participant leaving - clear their viewport
    unsubscribers.push(on('participant:left', (payload) => {
      const { participantId } = payload
      const newViewports = { ...participantsViewports.value }
      delete newViewports[participantId]
      participantsViewports.value = newViewports
    }))
  }

  /**
   * Cleanup subscriptions and pending operations
   */
  function cleanup() {
    // Unsubscribe from WebSocket events
    unsubscribers.forEach(unsub => unsub())
    unsubscribers = []

    // Clear throttle timeouts
    if (viewportThrottleTimeout) {
      clearTimeout(viewportThrottleTimeout)
      viewportThrottleTimeout = null
    }
    if (filterThrottleTimeout) {
      clearTimeout(filterThrottleTimeout)
      filterThrottleTimeout = null
    }

    // Clear pending updates
    pendingViewport = null
    pendingFilters = null
  }

  /**
   * Start following a participant
   */
  function startFollowing(targetId) {
    if (!isConnected.value) return false
    if (targetId === localParticipant.value?.id) return false // Can't follow self

    send('follow:start', { targetParticipantId: targetId })
    followingId.value = targetId
    return true
  }

  /**
   * Stop following
   */
  function stopFollowing() {
    if (!isConnected.value) return false
    if (!followingId.value) return false

    send('follow:stop', {})
    followingId.value = null
    return true
  }

  /**
   * Broadcast viewport (throttled)
   */
  function broadcastViewport(pageIndex, zoom, bounds) {
    if (!isConnected.value) return

    pendingViewport = { pageIndex, zoom, bounds }

    if (!viewportThrottleTimeout) {
      viewportThrottleTimeout = setTimeout(() => {
        if (pendingViewport) {
          send('viewport:update', pendingViewport)
          pendingViewport = null
        }
        viewportThrottleTimeout = null
      }, VIEWPORT_THROTTLE)
    }
  }

  /**
   * Broadcast viewport immediately (for page changes)
   */
  function broadcastViewportImmediate(pageIndex, zoom, bounds) {
    if (!isConnected.value) return

    // Clear any pending throttled update
    if (viewportThrottleTimeout) {
      clearTimeout(viewportThrottleTimeout)
      viewportThrottleTimeout = null
    }
    pendingViewport = null

    send('viewport:update', { pageIndex, zoom, bounds })
  }

  /**
   * Broadcast filters (throttled)
   */
  function broadcastFilters(pageIndex, filters) {
    if (!isConnected.value) return

    pendingFilters = { pageIndex, filters }

    if (!filterThrottleTimeout) {
      filterThrottleTimeout = setTimeout(() => {
        if (pendingFilters) {
          send('filters:update', pendingFilters)
          pendingFilters = null
        }
        filterThrottleTimeout = null
      }, FILTER_THROTTLE)
    }
  }

  /**
   * Check if local user is following a specific participant
   */
  function isFollowingParticipant(participantId) {
    return followingId.value === participantId
  }

  /**
   * Check if local user is being followed by a specific participant
   */
  function isFollowedByParticipant(participantId) {
    return followState.value[participantId] === localParticipant.value?.id
  }

  /**
   * Get who a participant is following
   */
  function getFollowedBy(participantId) {
    return followState.value[participantId] || null
  }

  /**
   * Get the page index for a participant
   */
  function getParticipantPage(participantId) {
    return participantsViewports.value[participantId] ?? null
  }

  /**
   * Register callback for viewport sync events
   */
  function onViewportSync(callback) {
    viewportSyncCallbacks.add(callback)
    return () => viewportSyncCallbacks.delete(callback)
  }

  /**
   * Register callback for filters sync events
   */
  function onFiltersSync(callback) {
    filtersSyncCallbacks.add(callback)
    return () => filtersSyncCallbacks.delete(callback)
  }

  return {
    // State
    followState: readonly(followState),
    followingId: readonly(followingId),
    isFollowing,
    followedParticipant,
    followersCount,
    myFollowers,
    participantsViewports: readonly(participantsViewports),

    // Actions
    init,
    cleanup,
    startFollowing,
    stopFollowing,
    broadcastViewport,
    broadcastViewportImmediate,
    broadcastFilters,

    // Queries
    isFollowingParticipant,
    isFollowedByParticipant,
    getFollowedBy,
    getParticipantPage,

    // Callbacks
    onViewportSync,
    onFiltersSync
  }
}
