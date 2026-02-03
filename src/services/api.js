const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3001'

class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body)
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

  if (response.status === 204) {
    return null
  }

  return response.json()
}

// Sessions API
export const sessionsApi = {
  create(data) {
    return request('/api/sessions', {
      method: 'POST',
      body: data
    })
  },

  get(sessionId) {
    return request(`/api/sessions/${sessionId}`)
  },

  updateAnnotations(sessionId, annotations) {
    return request(`/api/sessions/${sessionId}/annotations`, {
      method: 'PUT',
      body: { annotations }
    })
  },

  getByDevice(deviceId) {
    return request(`/api/sessions/device/${deviceId}`)
  },

  delete(sessionId) {
    return request(`/api/sessions/${sessionId}`, {
      method: 'DELETE'
    })
  }
}

// Versions API
export const versionsApi = {
  create(sessionId, data) {
    return request(`/api/sessions/${sessionId}/versions`, {
      method: 'POST',
      body: data
    })
  },

  list(sessionId) {
    return request(`/api/sessions/${sessionId}/versions`)
  },

  checkUnsaved(sessionId) {
    return request(`/api/sessions/${sessionId}/versions/check-unsaved`)
  },

  get(sessionId, versionId) {
    return request(`/api/sessions/${sessionId}/versions/${versionId}`)
  },

  restore(sessionId, versionId, restoredBy) {
    return request(`/api/sessions/${sessionId}/versions/${versionId}/restore`, {
      method: 'POST',
      body: { restoredBy }
    })
  },

  delete(sessionId, versionId) {
    return request(`/api/sessions/${sessionId}/versions/${versionId}`, {
      method: 'DELETE'
    })
  }
}

export { ApiError }
