import { prisma } from '../lib/prisma.js'
import { NotFoundError, PayloadTooLargeError } from '../utils/errors.js'
import { config } from '../config/env.js'
import { logger } from '../utils/logger.js'

export const sessionService = {
  /**
   * Create a new session
   */
  async create({ iiifManifest, documentName, annotations = {}, deviceId }) {
    logger.info('Creating new session', { iiifManifest, documentName })

    const session = await prisma.session.create({
      data: {
        iiifManifest,
        documentName: documentName || 'Untitled Document',
        annotations,
        creatorDeviceId: deviceId || null
      }
    })

    logger.info('Session created', { sessionId: session.id })
    return session
  },

  /**
   * Get session by ID
   */
  async getById(id) {
    const session = await prisma.session.findUnique({
      where: { id }
    })

    if (!session) {
      throw new NotFoundError(`Session not found: ${id}`)
    }

    // Update last active timestamp (don't await to avoid blocking)
    this.touch(id).catch(err => logger.error('Failed to update session activity', { sessionId: id, error: err.message }))

    return session
  },

  /**
   * Update session annotations
   */
  async updateAnnotations(id, annotations) {
    // Check payload size
    const size = JSON.stringify(annotations).length
    if (size > config.session.maxAnnotationsSize) {
      throw new PayloadTooLargeError(`Annotations exceed maximum size of ${config.session.maxAnnotationsSize / 1024 / 1024}MB`)
    }

    const session = await prisma.session.update({
      where: { id },
      data: {
        annotations,
        lastActiveAt: new Date()
      }
    })

    logger.debug('Session annotations updated', { sessionId: id })
    return session
  },

  /**
   * Update last_active_at timestamp
   */
  async touch(id) {
    return prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date() }
    })
  },

  /**
   * Get sessions by device ID (user's projects)
   */
  async getByDeviceId(deviceId) {
    const sessions = await prisma.session.findMany({
      where: { creatorDeviceId: deviceId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        iiifManifest: true,
        documentName: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return sessions
  },

  /**
   * Delete a session
   */
  async delete(id) {
    await prisma.session.delete({
      where: { id }
    })

    logger.info('Session deleted', { sessionId: id })
  },

  /**
   * Cleanup inactive sessions older than configured days
   */
  async cleanupInactive() {
    const cutoff = new Date(Date.now() - config.session.inactiveCleanupDays * 24 * 60 * 60 * 1000)

    const result = await prisma.session.deleteMany({
      where: {
        lastActiveAt: { lt: cutoff }
      }
    })

    logger.info('Cleanup completed', { deletedCount: result.count, cutoffDate: cutoff.toISOString() })
    return result.count
  },

  /**
   * Check if session exists
   */
  async exists(id) {
    const count = await prisma.session.count({
      where: { id }
    })
    return count > 0
  }
}
