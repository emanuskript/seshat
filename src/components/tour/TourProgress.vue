<script setup>
import { useTour } from '@/composables/useTour'

const { currentStepIndex, totalSteps, goToStep } = useTour()

function handleDotClick(index) {
  goToStep(index)
}
</script>

<template>
  <div class="tour-progress" role="tablist" aria-label="Tour progress">
    <button
      v-for="(_, index) in totalSteps"
      :key="index"
      class="tour-progress__dot"
      :class="{ 'tour-progress__dot--active': index === currentStepIndex }"
      role="tab"
      :aria-selected="index === currentStepIndex"
      :aria-label="`Go to step ${index + 1}`"
      @click="handleDotClick(index)"
    />
  </div>
</template>

<style scoped>
.tour-progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
}

.tour-progress__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: hsl(var(--muted));
  cursor: pointer;
  transition: all 0.2s ease;
}

.tour-progress__dot:hover {
  background: hsl(var(--muted-foreground));
}

.tour-progress__dot--active {
  width: 24px;
  border-radius: 4px;
  background: hsl(var(--primary));
}

.tour-progress__dot:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>
