<script setup>
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon/Icon.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { useVersionHistory } from '@/composables/useVersionHistory'
import { useSession } from '@/composables/useSession'
import CreateCheckpoint from './CreateCheckpoint.vue'

const props = defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'version-restored'])

const {
  versions,
  loadVersions,
  restoreVersion,
  createCheckpoint,
  checkUnsavedChanges,
  isLoading,
  error
} = useVersionHistory()
const { sessionId, localParticipant } = useSession()

const showCreateCheckpoint = ref(false)
const isRestoring = ref(false)

// Restore state for the smart restore flow
const restoreState = ref({
  version: null,           // Version being restored
  hasUnsavedChanges: null, // null = checking, true/false = result
  isChecking: false
})

// Load versions when panel opens
watch(() => props.open, async (open) => {
  if (open && sessionId.value) {
    await loadVersions(sessionId.value)
  }
})

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function resetRestoreState() {
  restoreState.value = { version: null, hasUnsavedChanges: null, isChecking: false }
}

async function initiateRestore(version) {
  restoreState.value = { version, hasUnsavedChanges: null, isChecking: true }

  const result = await checkUnsavedChanges(sessionId.value)

  if (!result.hasUnsavedChanges) {
    // No unsaved changes - restore directly
    await performRestore(version)
    resetRestoreState()
  } else {
    // Show warning dialog
    restoreState.value = { version, hasUnsavedChanges: true, isChecking: false }
  }
}

async function handleSaveAndRestore() {
  isRestoring.value = true
  try {
    // Create checkpoint first
    await createCheckpoint(sessionId.value, {
      name: 'Auto-save before restore',
      description: `Saved before restoring to v${restoreState.value.version.versionNumber}`,
      createdBy: localParticipant.value?.displayName || 'Anonymous'
    })
    // Then restore
    await performRestore(restoreState.value.version)
    // Reload to show the new checkpoint
    await loadVersions(sessionId.value)
    resetRestoreState()
  } catch (err) {
    console.error('Failed to save and restore:', err)
  } finally {
    isRestoring.value = false
  }
}

async function handleRestoreAnyway() {
  isRestoring.value = true
  try {
    await performRestore(restoreState.value.version)
    resetRestoreState()
  } catch (err) {
    console.error('Failed to restore:', err)
  } finally {
    isRestoring.value = false
  }
}

async function performRestore(version) {
  const result = await restoreVersion(sessionId.value, version.id)
  // Reload versions to show the new "Restored from vX" checkpoint
  await loadVersions(sessionId.value)
  emit('version-restored', result)
}
</script>

<template>
  <!-- Main Version History Dialog -->
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[500px] max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Version History</DialogTitle>
        <DialogDescription>
          View and restore previous versions of your annotations.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col flex-1 min-h-0 mt-4">
        <!-- Create checkpoint button -->
        <Button
          class="mb-4 shrink-0"
          @click="showCreateCheckpoint = true"
          :disabled="!sessionId"
        >
          <Icon name="plus" :size="16" class="mr-2" />
          Create Checkpoint
        </Button>

        <!-- Loading state -->
        <div v-if="isLoading && !restoreState.isChecking" class="flex items-center justify-center py-8">
          <Icon name="loader-2" :size="24" class="animate-spin text-muted-foreground" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="p-4 bg-destructive/10 text-destructive text-sm rounded-md">
          {{ error }}
        </div>

        <!-- Empty state -->
        <div v-else-if="versions.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="history" :size="48" class="mx-auto mb-4 opacity-50" />
          <p class="text-sm">No checkpoints yet.</p>
          <p class="text-xs mt-1">Create a checkpoint to save the current state.</p>
        </div>

        <!-- Versions list -->
        <div v-else class="flex-1 overflow-auto pr-2 space-y-3">
          <div
            v-for="version in versions"
            :key="version.id"
            class="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono text-muted-foreground">
                    v{{ version.versionNumber }}
                  </span>
                  <h4 class="font-medium truncate">{{ version.name }}</h4>
                </div>

                <p v-if="version.description" class="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {{ version.description }}
                </p>

                <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Icon name="user" :size="12" />
                    {{ version.createdBy }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Icon name="clock" :size="12" />
                    {{ formatDate(version.createdAt) }}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                :disabled="restoreState.isChecking"
                @click="initiateRestore(version)"
              >
                <Icon
                  v-if="restoreState.isChecking && restoreState.version?.id === version.id"
                  name="loader-2"
                  :size="14"
                  class="mr-1 animate-spin"
                />
                <Icon v-else name="rotate-ccw" :size="14" class="mr-1" />
                Restore
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Create Checkpoint Dialog -->
  <CreateCheckpoint
    v-model:open="showCreateCheckpoint"
    @checkpoint-created="loadVersions(sessionId)"
  />

  <!-- Warning Dialog (when unsaved changes detected) -->
  <Dialog
    :open="restoreState.hasUnsavedChanges === true"
    @update:open="resetRestoreState"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="alert-triangle" :size="20" class="text-yellow-500" />
          Unsaved Changes
        </DialogTitle>
        <DialogDescription>
          You have changes since your last checkpoint. Restoring to
          <strong>v{{ restoreState.version?.versionNumber }}: {{ restoreState.version?.name }}</strong>
          will lose them.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          @click="resetRestoreState"
          :disabled="isRestoring"
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          @click="handleRestoreAnyway"
          :disabled="isRestoring"
        >
          <Icon v-if="isRestoring" name="loader-2" :size="16" class="mr-2 animate-spin" />
          Restore Anyway
        </Button>
        <Button
          @click="handleSaveAndRestore"
          :disabled="isRestoring"
        >
          <Icon v-if="isRestoring" name="loader-2" :size="16" class="mr-2 animate-spin" />
          Save & Restore
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
