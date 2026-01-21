<script setup>
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useFollow } from '@/composables/useFollow'
import { usePresence } from '@/composables/usePresence'

const { isFollowing, followingId, stopFollowing } = useFollow()
const { participants } = usePresence()

const followedParticipant = computed(() => {
  if (!followingId.value) return null
  return participants.value.find(p => p.id === followingId.value)
})

const followedName = computed(() => {
  return followedParticipant.value?.displayName || 'User'
})

const followedColor = computed(() => {
  return followedParticipant.value?.color || '#888888'
})

function handleStop() {
  stopFollowing()
}
</script>

<template>
  <div v-if="isFollowing" class="follow-indicator">
    <div class="follow-content">
      <svg
        class="eye-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span class="follow-text">
        Following
        <span class="follow-name" :style="{ color: followedColor }">
          {{ followedName }}
        </span>
      </span>
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="stop-btn"
      @click="handleStop"
    >
      Stop
    </Button>
  </div>
</template>

<style scoped>
.follow-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  font-size: 13px;
}

.follow-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.eye-icon {
  color: hsl(var(--primary));
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.follow-text {
  color: hsl(var(--foreground));
}

.follow-name {
  font-weight: 600;
}

.stop-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}
</style>
