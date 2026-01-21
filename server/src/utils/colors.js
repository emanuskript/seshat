// Predefined colors for participant cursors
// Chosen for good contrast and visibility across themes
const PARTICIPANT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky blue
  '#96CEB4', // Sage green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Lavender
  '#85C1E9', // Light blue
  '#F8B500', // Amber
  '#00CED1', // Dark cyan
  '#FF7F50', // Coral
  '#9FE2BF', // Sea green
  '#DE3163', // Cerise
  '#40E0D0'  // Turquoise
]

// Track assigned colors per session to avoid duplicates
const sessionColorAssignments = new Map()

export function assignParticipantColor(sessionId, participantId) {
  if (!sessionColorAssignments.has(sessionId)) {
    sessionColorAssignments.set(sessionId, new Map())
  }

  const sessionColors = sessionColorAssignments.get(sessionId)

  // Check if participant already has a color
  if (sessionColors.has(participantId)) {
    return sessionColors.get(participantId)
  }

  // Find an unused color
  const usedColors = new Set(sessionColors.values())
  let color = PARTICIPANT_COLORS.find(c => !usedColors.has(c))

  // If all colors are used, cycle through them
  if (!color) {
    const index = sessionColors.size % PARTICIPANT_COLORS.length
    color = PARTICIPANT_COLORS[index]
  }

  sessionColors.set(participantId, color)
  return color
}

export function releaseParticipantColor(sessionId, participantId) {
  const sessionColors = sessionColorAssignments.get(sessionId)
  if (sessionColors) {
    sessionColors.delete(participantId)
    if (sessionColors.size === 0) {
      sessionColorAssignments.delete(sessionId)
    }
  }
}

export function clearSessionColors(sessionId) {
  sessionColorAssignments.delete(sessionId)
}

export { PARTICIPANT_COLORS }
