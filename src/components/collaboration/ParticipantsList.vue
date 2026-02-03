<script setup>
import { computed } from 'vue'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { usePresence } from '@/composables/usePresence'
import { useFollow } from '@/composables/useFollow'

const { participants, localParticipant, participantCount } = usePresence()
const {
  isFollowingParticipant,
  startFollowing,
  stopFollowing,
  getParticipantPage,
  followersCount
} = useFollow()

const displayParticipants = computed(() => {
  // Show up to 4 participants, with local participant first
  const sorted = [...participants.value].sort((a, b) => {
    if (a.id === localParticipant.value?.id) return -1
    if (b.id === localParticipant.value?.id) return 1
    return 0
  })
  return sorted.slice(0, 4)
})

const overflowCount = computed(() => {
  return Math.max(0, participantCount.value - 4)
})

function isLocal(participant) {
  return participant.id === localParticipant.value?.id
}

function handleFollowClick(participant, event) {
  event.stopPropagation()
  if (isFollowingParticipant(participant.id)) {
    stopFollowing()
  } else {
    startFollowing(participant.id)
  }
}

function getPageDisplay(participant) {
  const page = participant.pageIndex ?? getParticipantPage(participant.id)
  if (page === null || page === undefined) return null
  return page + 1  // Convert to 1-indexed
}
</script>

<template>
  <div v-if="participantCount > 0" class="flex items-center gap-1">
    <Tooltip v-for="participant in displayParticipants" :key="participant.id">
      <TooltipTrigger>
        <div
          class="participant-avatar"
          :class="{
            'is-following': isFollowingParticipant(participant.id),
            'is-local': isLocal(participant)
          }"
          :style="{ backgroundColor: participant.color }"
        >
          {{ participant.displayName.charAt(0).toUpperCase() }}
          <!-- Page indicator badge -->
          <span
            v-if="!isLocal(participant) && getPageDisplay(participant)"
            class="page-badge"
          >
            p{{ getPageDisplay(participant) }}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent class="participant-tooltip">
        <div class="tooltip-header">
          <span class="tooltip-name">{{ participant.displayName }}</span>
          <span v-if="isLocal(participant)" class="tooltip-you">(you)</span>
        </div>

        <div v-if="!isLocal(participant)" class="tooltip-actions">
          <Button
            v-if="!isFollowingParticipant(participant.id)"
            variant="outline"
            size="sm"
            class="follow-btn"
            @click="handleFollowClick(participant, $event)"
          >
            <svg
              width="14"
              height="14"
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
            Follow their view
          </Button>
          <Button
            v-else
            variant="default"
            size="sm"
            class="follow-btn following"
            @click="handleFollowClick(participant, $event)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            Stop following
          </Button>
        </div>

        <div v-if="isLocal(participant) && followersCount > 0" class="tooltip-followers">
          <span class="followers-count">{{ followersCount }} {{ followersCount === 1 ? 'person' : 'people' }} following you</span>
        </div>
      </TooltipContent>
    </Tooltip>

    <div
      v-if="overflowCount > 0"
      class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground border-2 border-background -ml-2"
    >
      +{{ overflowCount }}
    </div>

    <span class="text-xs text-muted-foreground ml-2">
      {{ participantCount }} {{ participantCount === 1 ? 'person' : 'people' }}
    </span>
  </div>
</template>

<style scoped>
.participant-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: white;
  border: 2px solid hsl(var(--background));
  margin-left: -8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.participant-avatar:first-child {
  margin-left: 0;
}

.participant-avatar.is-following {
  box-shadow: 0 0 0 2px hsl(var(--primary));
}

.participant-avatar.is-local {
  opacity: 0.8;
}

.page-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 600;
  color: hsl(var(--foreground));
  line-height: 1.2;
}

.participant-tooltip {
  min-width: 160px;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.tooltip-name {
  font-weight: 600;
}

.tooltip-you {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.tooltip-actions {
  margin-top: 4px;
}

.follow-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.follow-btn.following {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.tooltip-followers {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
}

.followers-count {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
