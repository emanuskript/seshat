import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  session: {
    maxAnnotationsSize: 5 * 1024 * 1024, // 5MB
    maxVersionsPerSession: 100,
    inactiveCleanupDays: 90
  }
}
