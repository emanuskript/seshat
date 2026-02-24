// src/services/api.js

const RAW_BASE =
  (typeof process !== 'undefined' && process.env && process.env.VUE_APP_API_URL) ||
  (typeof window !== 'undefined' && window.location && window.location.origin) ||
  'http://localhost:3001'

// Normalize: trim trailing slashes, and if someone sets ".../api" avoid "/api/api/..."
const API_URL = RAW_BASE.replace(/\/+$/, '').replace(/\/api$/, '')

class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`
  const config = { ...options }

  // Only set JSON content-type when sending JSON
  if (config.body !== undefined) {
    if (config.body instanceof FormData) {
      // Let browser set multipart boundary
    } else if (typeof config.body === 'object') {
      config.headers = { 'Content-Type': 'application/json', ...(config.headers || {}) }
      config.body = JSON.stringify(config.body)
    }
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ApiError(
      error.error?.message || `Request failed: ${response.status}`,
      response.status,
      error.error?.code || 'UNKNOWN_ERROR'
    )
  }

  if (response.status === 204) return null
  return response.json()
}

export const sessionsApi = {
  createSession: (data) =>
    request('/api/sessions', {
      method: 'POST',
      body: data
    }),

  joinSession: (sessionId, data) =>
    request(`/api/sessions/${sessionId}/join`, {
      method: 'POST',
      body: data
    }),

  getSession: (sessionId) => request(`/api/sessions/${sessionId}`),

  updateAnnotations: (sessionId, data) =>
    request(`/api/sessions/${sessionId}/annotations`, {
      method: 'PUT',
      body: data
    }),

  getSessionVersions: (sessionId) => request(`/api/sessions/${sessionId}/versions`)
}

export const versionsApi = {
  createVersion: (sessionId, data) =>
    request(`/api/sessions/${sessionId}/versions`, {
      method: 'POST',
      body: data
    }),

  restoreVersion: (sessionId, versionId, data) =>
    request(`/api/sessions/${sessionId}/versions/${versionId}/restore`, {
      method: 'POST',
      body: data
    }),

  deleteVersion: (sessionId, versionId) =>
    request(`/api/sessions/${sessionId}/versions/${versionId}`, {
      method: 'DELETE'
    })
}

export { ApiError }
