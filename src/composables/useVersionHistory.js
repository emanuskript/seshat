import { ref, readonly } from 'vue'
import { versionsApi } from '@/services/api'

// Module-level state
const versions = ref([])
const isLoading = ref(false)
const error = ref(null)

export function useVersionHistory() {
  /**
   * Load versions for a session
   */
  async function loadVersions(sessionId) {
    if (!sessionId) return

    isLoading.value = true
    error.value = null

    try {
      const result = await versionsApi.list(sessionId)
      versions.value = result.versions || []
    } catch (err) {
      error.value = err.message
      versions.value = []
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new version checkpoint
   */
  async function createCheckpoint(sessionId, { name, description, createdBy }) {
    if (!sessionId) {
      throw new Error('No session ID provided')
    }

    isLoading.value = true
    error.value = null

    try {
      const version = await versionsApi.create(sessionId, {
        name,
        description,
        createdBy
      })

      // Add to the beginning of the list (newest first)
      versions.value = [version, ...versions.value]

      return version
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get full version details including annotations
   */
  async function getVersionDetails(sessionId, versionId) {
    if (!sessionId || !versionId) {
      throw new Error('Session ID and Version ID required')
    }

    try {
      return await versionsApi.get(sessionId, versionId)
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Restore session to a previous version
   * Returns the restored annotations
   */
  async function restoreVersion(sessionId, versionId) {
    if (!sessionId || !versionId) {
      throw new Error('Session ID and Version ID required')
    }

    isLoading.value = true
    error.value = null

    try {
      const result = await versionsApi.restore(sessionId, versionId)
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if there are unsaved changes since last checkpoint
   */
  async function checkUnsavedChanges(sessionId) {
    if (!sessionId) {
      return { hasUnsavedChanges: false, lastVersion: null }
    }

    try {
      return await versionsApi.checkUnsaved(sessionId)
    } catch (err) {
      console.error('Failed to check unsaved changes:', err)
      // Default to showing warning on error (safer)
      return { hasUnsavedChanges: true, lastVersion: null }
    }
  }

  /**
   * Delete a version
   */
  async function deleteVersion(sessionId, versionId) {
    if (!sessionId || !versionId) {
      throw new Error('Session ID and Version ID required')
    }

    try {
      await versionsApi.delete(sessionId, versionId)
      versions.value = versions.value.filter(v => v.id !== versionId)
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Clear versions state
   */
  function clearVersions() {
    versions.value = []
    error.value = null
  }

  return {
    // State
    versions: readonly(versions),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Actions
    loadVersions,
    createCheckpoint,
    getVersionDetails,
    restoreVersion,
    deleteVersion,
    clearVersions,
    checkUnsavedChanges
  }
}
