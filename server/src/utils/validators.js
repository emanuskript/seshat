import { ValidationError } from './errors.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str)
}

export function validateUUID(str, fieldName = 'id') {
  if (!isValidUUID(str)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid UUID`)
  }
  return str
}

export function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`)
  }
  return value
}

export function validateString(value, fieldName, { minLength = 0, maxLength = Infinity } = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`)
  }
  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`)
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must not exceed ${maxLength} characters`)
  }
  return value
}

export function validateObject(value, fieldName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`)
  }
  return value
}

export function validateUrl(value, fieldName) {
  try {
    new URL(value)
    return value
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`)
  }
}

export function validateSessionCreate(data) {
  validateRequired(data.iiifManifest, 'iiifManifest')
  // Allow JSON arrays (uploaded multi-page images) or valid URLs
  if (!data.iiifManifest.startsWith('[')) {
    validateUrl(data.iiifManifest, 'iiifManifest')
  }

  if (data.documentName !== undefined) {
    validateString(data.documentName, 'documentName', { maxLength: 255 })
  }

  if (data.annotations !== undefined) {
    validateObject(data.annotations, 'annotations')
  }

  if (data.deviceId !== undefined && data.deviceId !== null) {
    validateUUID(data.deviceId, 'deviceId')
  }

  return {
    iiifManifest: data.iiifManifest,
    documentName: data.documentName || 'Untitled Document',
    annotations: data.annotations || {},
    deviceId: data.deviceId || null
  }
}

export function validateVersionCreate(data) {
  validateRequired(data.name, 'name')
  validateString(data.name, 'name', { minLength: 1, maxLength: 255 })

  if (data.description !== undefined) {
    validateString(data.description, 'description', { maxLength: 1000 })
  }

  if (data.createdBy !== undefined) {
    validateString(data.createdBy, 'createdBy', { maxLength: 100 })
  }

  return {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    createdBy: data.createdBy?.trim() || 'Anonymous'
  }
}
