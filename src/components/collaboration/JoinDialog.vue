<script setup>
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
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

const props = defineProps({
  open: { type: Boolean, default: false },
  documentName: { type: String, default: 'Document' }
})

const emit = defineEmits(['update:open', 'join'])

const displayName = ref(localStorage.getItem('quillapp-display-name') || '')

const internalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// Reset on open
watch(() => props.open, (open) => {
  if (open) {
    displayName.value = localStorage.getItem('quillapp-display-name') || ''
  }
})

function handleJoin() {
  const name = displayName.value.trim() || 'Anonymous'
  localStorage.setItem('quillapp-display-name', name)
  emit('join', name)
  internalOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="internalOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Join Session</DialogTitle>
        <DialogDescription>
          You're joining a collaborative session for "{{ documentName }}".
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="joinDisplayName">Your Display Name</Label>
          <Input
            id="joinDisplayName"
            v-model="displayName"
            placeholder="Enter your name"
            @keydown.enter="handleJoin"
          />
          <p class="text-xs text-muted-foreground">
            This name will be visible to other participants.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button @click="handleJoin">
          Join Session
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
