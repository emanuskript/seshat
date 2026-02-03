import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, next) {
  // Log the error
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500
  })

  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    })
  }

  // Handle Prisma errors
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found'
      }
    })
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists'
      }
    })
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body'
      }
    })
  }

  // Default to 500 internal server error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  })
}
