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
import { useVersionHistory } from '@/composables/useVersionHistory'
import { useSession } from '@/composables/useSession'

const props = defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'checkpoint-created'])

const { createCheckpoint, isLoading, error } = useVersionHistory()
const { sessionId, localParticipant } = useSession()

const name = ref('')
const description = ref('')

const internalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// Reset state when dialog opens
watch(() => props.open, (open) => {
  if (open) {
    name.value = ''
    description.value = ''
  }
})

async function handleCreate() {
  if (!name.value.trim()) return

  try {
    const version = await createCheckpoint(sessionId.value, {
      name: name.value.trim(),
      description: description.value.trim() || null,
      createdBy: localParticipant.value?.displayName || 'Anonymous'
    })

    emit('checkpoint-created', version)
    internalOpen.value = false
  } catch (err) {
    console.error('Failed to create checkpoint:', err)
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
        <DialogTitle>Create Checkpoint</DialogTitle>
        <DialogDescription>
          Save the current state of your annotations. You can restore to this point later.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="checkpointName">Name *</Label>
          <Input
            id="checkpointName"
            v-model="name"
            placeholder="e.g., 'Initial analysis', 'After review'"
            :disabled="isLoading"
            @keydown.enter="handleCreate"
          />
        </div>

        <div class="space-y-2">
          <Label for="checkpointDescription">Description (optional)</Label>
          <textarea
            id="checkpointDescription"
            v-model="description"
            placeholder="Add notes about what changed..."
            :disabled="isLoading"
            rows="3"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div v-if="error" class="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {{ error }}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="closeDialog" :disabled="isLoading">
          Cancel
        </Button>
        <Button
          @click="handleCreate"
          :disabled="isLoading || !name.trim()"
        >
          <Icon v-if="isLoading" name="loader-2" :size="16" class="mr-2 animate-spin" />
          <Icon v-else name="save" :size="16" class="mr-2" />
          Save Checkpoint
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
