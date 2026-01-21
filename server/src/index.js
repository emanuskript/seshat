import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'

import { config } from './config/env.js'
import { connectPrisma, disconnectPrisma } from './lib/prisma.js'
import { initWebSocket, closeWebSocket } from './websocket/index.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { logger } from './utils/logger.js'

import sessionsRouter from './routes/sessions.js'
import versionsRouter from './routes/versions.js'

const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for API server
}))

// CORS
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))

// Rate limiting
app.use('/api', apiLimiter)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/sessions', sessionsRouter)
app.use('/api/sessions/:sessionId/versions', versionsRouter)

// 404 handler
app.use(notFoundHandler)

// Error handler
app.use(errorHandler)

// Create HTTP server
const server = createServer(app)

// Initialize WebSocket
initWebSocket(server)

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`)

  closeWebSocket()
  await disconnectPrisma()

  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start server
async function start() {
  try {
    // Connect to database
    await connectPrisma()

    // Start listening on all interfaces (0.0.0.0) for VM/container access
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on 0.0.0.0:${config.port}`)
      logger.info(`Environment: ${config.nodeEnv}`)
      logger.info(`CORS origin: ${config.cors.origin}`)
    })
  } catch (err) {
    logger.error('Failed to start server', { error: err.message })
    process.exit(1)
  }
}

start()
