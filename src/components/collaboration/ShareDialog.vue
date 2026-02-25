<script setup>
import { ref, computed, watch } from 'vue'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/composables/useSession'

const props = defineProps({
  open: { type: Boolean, default: false },
  iiifManifest: { type: String, default: '' },
  documentName: { type: String, default: '' },
  currentAnnotations: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:open', 'session-created'])

const { createSession, joinSession, shareUrl, isLoading, error, sessionId } = useSession()

const displayName = ref(localStorage.getItem('quillapp-display-name') || '')
const copied = ref(false)

// Show share URL if session already exists, otherwise show creation form
const hasExistingSession = computed(() => !!sessionId.value)

const internalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// Reset state when dialog opens
watch(() => props.open, (open) => {
  if (open) {
    copied.value = false
    if (error.value) error.value = null
  }
})

async function handleCreateSession() {
  try {
    // Save display name
    const name = displayName.value.trim() || 'Anonymous'
    localStorage.setItem('quillapp-display-name', name)

    const session = await createSession(
      props.iiifManifest,
      props.documentName,
      props.currentAnnotations
    )

    // Try to join the session for real-time sync (non-blocking)
    try {
      await joinSession(session.id, name)
    } catch (joinErr) {
      console.warn('WebSocket join skipped (non-fatal):', joinErr)
    }

    emit('session-created', session)
  } catch (err) {
    console.error('Failed to create session:', err)
  }
}

async function copyToClipboard() {
  if (!shareUrl.value) return

  try {
    // navigator.clipboard requires HTTPS; fall back to execCommand on HTTP
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl.value)
    } else {
      const ta = document.createElement('textarea')
      ta.value = shareUrl.value
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function closeDialog() {
  internalOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="internalOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Share Session</DialogTitle>
        <DialogDescription>
          {{ hasExistingSession
            ? 'Share this link with others to collaborate in real-time.'
            : 'Create a shareable session to collaborate with others.'
          }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="!hasExistingSession" class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="displayName">Your Display Name</Label>
          <Input
            id="displayName"
            v-model="displayName"
            placeholder="Enter your name"
            :disabled="isLoading"
          />
          <p class="text-xs text-muted-foreground">
            This name will be visible to other participants.
          </p>
        </div>

        <div v-if="error" class="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {{ error }}
        </div>
      </div>

      <div v-else class="space-y-4 py-4">
        <div class="flex items-center gap-2">
          <Input
            :model-value="shareUrl"
            readonly
            class="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            @click="copyToClipboard"
            :disabled="copied"
          >
            <Icon :name="copied ? 'check' : 'copy'" :size="18" />
          </Button>
        </div>

        <p v-if="copied" class="text-sm text-green-600">
          Link copied to clipboard!
        </p>

        <div class="bg-muted/50 p-3 rounded-md space-y-2">
          <p class="text-sm font-medium">Share options:</p>
          <ul class="text-xs text-muted-foreground space-y-1">
            <li>• Anyone with the link can view and edit</li>
            <li>• Changes sync in real-time</li>
            <li>• No account required</li>
          </ul>
        </div>
      </div>

      <DialogFooter>
        <Button v-if="!hasExistingSession" variant="outline" @click="closeDialog">
          Cancel
        </Button>
        <Button
          v-if="!hasExistingSession"
          @click="handleCreateSession"
          :disabled="isLoading"
        >
          <Icon v-if="isLoading" name="loader-2" :size="16" class="mr-2 animate-spin" />
          Create Session
        </Button>
        <Button v-else @click="closeDialog">
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
