import { assignParticipantColor, releaseParticipantColor, clearSessionColors } from '../utils/colors.js'
import { logger } from '../utils/logger.js'

// In-memory storage for active participants
// Structure: Map<sessionId, Map<participantId, participant>>
const sessions = new Map()

// Stale participant timeout (30 seconds without activity)
const STALE_TIMEOUT = 30000

export const presenceService = {
  /**
   * Add a participant to a session (or update if reconnecting)
   */
  join(sessionId, participantId, { displayName, ws }) {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Map())
    }

    const sessionParticipants = sessions.get(sessionId)
    const existingParticipant = sessionParticipants.get(participantId)

    // If participant already exists (reconnection), update their connection
    if (existingParticipant) {
      existingParticipant.ws = ws
      existingParticipant.displayName = displayName || existingParticipant.displayName
      existingParticipant.lastSeen = Date.now()

      logger.info('Participant reconnected', {
        sessionId,
        participantId,
        displayName: existingParticipant.displayName,
        totalParticipants: sessionParticipants.size
      })

      return { ...existingParticipant, isReconnect: true }
    }

    // New participant
    const color = assignParticipantColor(sessionId, participantId)

    const participant = {
      id: participantId,
      displayName: displayName || 'Anonymous',
      color,
      cursor: null,
      lastSeen: Date.now(),
      ws,
      // Follow mode state
      following: null,        // participantId they're following
      viewport: null,         // { pageIndex, zoom, bounds, timestamp }
      filters: null           // { pageIndex, filters, timestamp }
    }

    sessionParticipants.set(participantId, participant)

    logger.info('Participant joined', {
      sessionId,
      participantId,
      displayName: participant.displayName,
      totalParticipants: sessionParticipants.size
    })

    return participant
  },

  /**
   * Remove a participant from a session
   */
  leave(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return

    const participant = sessionParticipants.get(participantId)
    if (!participant) return

    sessionParticipants.delete(participantId)
    releaseParticipantColor(sessionId, participantId)

    logger.info('Participant left', {
      sessionId,
      participantId,
      remainingParticipants: sessionParticipants.size
    })

    // Clean up empty sessions
    if (sessionParticipants.size === 0) {
      sessions.delete(sessionId)
      clearSessionColors(sessionId)
    }

    return participant
  },

  /**
   * Update participant cursor position
   */
  updateCursor(sessionId, participantId, cursor) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    if (!participant) return null

    participant.cursor = cursor
    participant.lastSeen = Date.now()

    return participant
  },

  /**
   * Update participant last seen timestamp
   */
  heartbeat(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return

    const participant = sessionParticipants.get(participantId)
    if (participant) {
      participant.lastSeen = Date.now()
    }
  },

  /**
   * Get all participants in a session
   */
  getParticipants(sessionId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return []

    return Array.from(sessionParticipants.values()).map(p => ({
      id: p.id,
      displayName: p.displayName,
      color: p.color,
      cursor: p.cursor,
      pageIndex: p.viewport?.pageIndex ?? null,
      following: p.following
    }))
  },

  /**
   * Get a specific participant
   */
  getParticipant(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    if (!participant) return null

    return {
      id: participant.id,
      displayName: participant.displayName,
      color: participant.color,
      cursor: participant.cursor,
      pageIndex: participant.viewport?.pageIndex ?? null,
      following: participant.following
    }
  },

  /**
   * Get all participants with their WebSocket connections
   * Used for broadcasting messages
   */
  getParticipantsWithConnections(sessionId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return []

    return Array.from(sessionParticipants.values())
  },

  /**
   * Broadcast a message to all participants in a session except the sender
   */
  broadcast(sessionId, senderId, message) {
    const participants = this.getParticipantsWithConnections(sessionId)

    participants.forEach(participant => {
      if (participant.id !== senderId && participant.ws?.readyState === 1) {
        try {
          participant.ws.send(JSON.stringify(message))
        } catch (err) {
          logger.error('Failed to send message to participant', {
            sessionId,
            participantId: participant.id,
            error: err.message
          })
        }
      }
    })
  },

  /**
   * Broadcast a message to all participants including the sender
   */
  broadcastAll(sessionId, message) {
    const participants = this.getParticipantsWithConnections(sessionId)

    participants.forEach(participant => {
      if (participant.ws?.readyState === 1) {
        try {
          participant.ws.send(JSON.stringify(message))
        } catch (err) {
          logger.error('Failed to send message to participant', {
            sessionId,
            participantId: participant.id,
            error: err.message
          })
        }
      }
    })
  },

  // ==================== FOLLOW MODE METHODS ====================

  /**
   * Set who a participant is following
   */
  setFollowing(sessionId, participantId, targetId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    if (!participant) return null

    participant.following = targetId
    return participant
  },

  /**
   * Get who a participant is following
   */
  getFollowing(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    return participant?.following || null
  },

  /**
   * Get all participants following a specific target
   */
  getFollowersOf(sessionId, targetId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return []

    const followers = []
    sessionParticipants.forEach((participant, participantId) => {
      if (participant.following === targetId) {
        followers.push(participantId)
      }
    })
    return followers
  },

  /**
   * Get the follow state for the entire session
   * Returns { followers: { [participantId]: targetId } }
   */
  getFollowState(sessionId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return { followers: {} }

    const followers = {}
    sessionParticipants.forEach((participant, participantId) => {
      if (participant.following) {
        followers[participantId] = participant.following
      }
    })
    return { followers }
  },

  /**
   * Update participant viewport state
   */
  setViewport(sessionId, participantId, viewport) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    if (!participant) return null

    participant.viewport = { ...viewport, timestamp: Date.now() }
    participant.lastSeen = Date.now()
    return participant
  },

  /**
   * Get participant viewport state
   */
  getViewport(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    return participant?.viewport || null
  },

  /**
   * Update participant filters state
   */
  setFilters(sessionId, participantId, filtersState) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    if (!participant) return null

    participant.filters = { ...filtersState, timestamp: Date.now() }
    participant.lastSeen = Date.now()
    return participant
  },

  /**
   * Get participant filters state
   */
  getFilters(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    const participant = sessionParticipants.get(participantId)
    return participant?.filters || null
  },

  /**
   * Get a participant with their WebSocket connection
   */
  getParticipantWithConnection(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return null

    return sessionParticipants.get(participantId) || null
  },

  /**
   * Send a message to a specific participant
   */
  sendToParticipant(sessionId, participantId, message) {
    const participant = this.getParticipantWithConnection(sessionId, participantId)
    if (!participant || participant.ws?.readyState !== 1) return false

    try {
      participant.ws.send(JSON.stringify(message))
      return true
    } catch (err) {
      logger.error('Failed to send message to participant', {
        sessionId,
        participantId,
        error: err.message
      })
      return false
    }
  },

  /**
   * Clear follow relationships when a participant leaves
   */
  clearFollowRelationships(sessionId, participantId) {
    const sessionParticipants = sessions.get(sessionId)
    if (!sessionParticipants) return []

    const affectedFollowers = []
    sessionParticipants.forEach((participant, id) => {
      if (participant.following === participantId) {
        participant.following = null
        affectedFollowers.push(id)
      }
    })
    return affectedFollowers
  },

  /**
   * Clean up stale participants (not seen in STALE_TIMEOUT)
   */
  cleanupStale() {
    const now = Date.now()
    let cleaned = 0

    sessions.forEach((participants, sessionId) => {
      participants.forEach((participant, participantId) => {
        if (now - participant.lastSeen > STALE_TIMEOUT) {
          this.leave(sessionId, participantId)
          cleaned++
        }
      })
    })

    if (cleaned > 0) {
      logger.debug('Cleaned up stale participants', { count: cleaned })
    }

    return cleaned
  },

  /**
   * Get statistics about active sessions
   */
  getStats() {
    let totalParticipants = 0
    sessions.forEach(participants => {
      totalParticipants += participants.size
    })

    return {
      activeSessions: sessions.size,
      totalParticipants
    }
  }
}

// Run cleanup every 10 seconds
setInterval(() => {
  presenceService.cleanupStale()
}, 10000)
