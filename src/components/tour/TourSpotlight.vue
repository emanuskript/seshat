<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTour } from '@/composables/useTour'
import { useFocusTrap } from '@/composables/useFocusTrap'
import TourTooltip from './TourTooltip.vue'

const props = defineProps({
  step: {
    type: Object,
    required: true
  }
})

const { isPaused, skipTour, nextStep, prevStep, isFirstStep, isLastStep } = useTour()

const spotlightRef = ref(null)
const targetRect = ref(null)
const isPositioned = ref(false)

// Focus trap for accessibility
const isTrapActive = computed(() => !isPaused.value)
useFocusTrap(spotlightRef, isTrapActive)

// Calculate spotlight cutout position
const cutoutStyle = computed(() => {
  if (!targetRect.value) {
    return {
      '--cutout-top': '50%',
      '--cutout-left': '50%',
      '--cutout-width': '0px',
      '--cutout-height': '0px',
      '--cutout-radius': '0px',
    }
  }

  const padding = props.step.spotlightPadding ?? 8
  const radius = props.step.spotlightRadius ?? 8

  return {
    '--cutout-top': `${targetRect.value.top - padding}px`,
    '--cutout-left': `${targetRect.value.left - padding}px`,
    '--cutout-width': `${targetRect.value.width + padding * 2}px`,
    '--cutout-height': `${targetRect.value.height + padding * 2}px`,
    '--cutout-radius': `${radius}px`,
  }
})

// Get target element and calculate position
async function updateTargetPosition() {
  await nextTick()

  const selector = props.step.target
  if (!selector) {
    targetRect.value = null
    isPositioned.value = true
    return
  }

  const element = document.querySelector(selector)
  if (!element) {
    console.warn(`Tour target not found: ${selector}`)
    targetRect.value = null
    isPositioned.value = true
    return
  }

  const rect = element.getBoundingClientRect()
  targetRect.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  }

  // Scroll element into view if needed
  if (props.step.scrollIntoView !== false) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }

  isPositioned.value = true
}

// Watch for step changes
watch(() => props.step, updateTargetPosition, { immediate: true })

// Handle window resize and scroll
let resizeObserver = null

onMounted(() => {
  window.addEventListener('resize', updateTargetPosition)
  window.addEventListener('scroll', updateTargetPosition, true)

  // Use ResizeObserver for dynamic content
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(updateTargetPosition)
    resizeObserver.observe(document.body)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTargetPosition)
  window.removeEventListener('scroll', updateTargetPosition, true)
  resizeObserver?.disconnect()
})

// Handle keyboard navigation
function handleKeydown(e) {
  switch (e.key) {
    case 'Escape':
      skipTour()
      break
    case 'ArrowRight':
      if (!isLastStep.value) nextStep()
      break
    case 'ArrowLeft':
      if (!isFirstStep.value) prevStep()
      break
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="spotlightRef"
      class="tour-spotlight"
      :style="cutoutStyle"
      role="dialog"
      aria-modal="true"
      :aria-label="`Tour step: ${step.title}`"
      @keydown="handleKeydown"
    >
      <!-- Overlay with cutout -->
      <div class="tour-spotlight__overlay" :class="{ 'tour-spotlight__overlay--no-target': !targetRect }" />

      <!-- Tooltip positioned relative to target -->
      <TourTooltip
        v-if="isPositioned"
        :step="step"
        :target-rect="targetRect"
      />

      <!-- Screen reader live region for step announcements -->
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {{ `Step ${step.id}: ${step.title}. ${step.content}` }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tour-spotlight {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.tour-spotlight__overlay {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.75);
  transition: clip-path 0.3s ease;

  /* Clip path for cutout - creates a "hole" in the overlay */
  clip-path: polygon(
    /* Outer rectangle */
    0% 0%,
    0% 100%,
    /* Left side of cutout */
    var(--cutout-left) 100%,
    var(--cutout-left) var(--cutout-top),
    /* Top of cutout */
    calc(var(--cutout-left) + var(--cutout-width)) var(--cutout-top),
    /* Right side of cutout */
    calc(var(--cutout-left) + var(--cutout-width)) calc(var(--cutout-top) + var(--cutout-height)),
    /* Bottom of cutout */
    var(--cutout-left) calc(var(--cutout-top) + var(--cutout-height)),
    var(--cutout-left) 100%,
    /* Back to outer rectangle */
    100% 100%,
    100% 0%
  );
}

/* When there's no target, show full overlay */
.tour-spotlight__overlay--no-target {
  clip-path: none;
}

/* High contrast theme adjustments */
.high-contrast .tour-spotlight__overlay {
  background: rgba(0, 0, 0, 0.9);
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
