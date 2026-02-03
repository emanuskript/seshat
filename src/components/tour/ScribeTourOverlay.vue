<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useScribeTour } from '@/composables/useScribeTour'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon/Icon.vue'

const {
  isActive,
  currentStep,
  currentStepIndex,
  totalSteps,
  isFirstStep,
  isLastStep,
  nextStep,
  prevStep,
  skipTour
} = useScribeTour()

const overlayRef = ref(null)
const tooltipRef = ref(null)
const targetRect = ref(null)
const tooltipPosition = ref({ top: 0, left: 0 })
const arrowPosition = ref('bottom')

// Find target element within the modal
function findTarget() {
  if (!currentStep.value?.target) {
    targetRect.value = null
    return
  }

  // Look for the target within the modal context
  const modalCard = document.querySelector('.scribe-card')
  if (!modalCard) {
    targetRect.value = null
    return
  }

  const target = modalCard.querySelector(currentStep.value.target)
  if (target) {
    const rect = target.getBoundingClientRect()
    const modalRect = modalCard.getBoundingClientRect()

    // Convert to coordinates relative to modal card
    targetRect.value = {
      top: rect.top - modalRect.top,
      left: rect.left - modalRect.left,
      bottom: rect.bottom - modalRect.top,
      right: rect.right - modalRect.left,
      width: rect.width,
      height: rect.height
    }
  } else {
    targetRect.value = null
  }
}

// Generate clip-path for spotlight effect
const backdropClipPath = computed(() => {
  if (!targetRect.value) {
    return { clipPath: 'none', background: 'rgba(0, 0, 0, 0.6)' }
  }

  const padding = 8
  const r = targetRect.value
  const top = Math.max(0, r.top - padding)
  const left = Math.max(0, r.left - padding)
  const right = r.right + padding
  const bottom = r.bottom + padding
  const borderRadius = 8

  // Create a polygon that covers everything except the target area
  // Using a complex polygon to create a "hole" effect
  return {
    clipPath: `polygon(
      0% 0%,
      0% 100%,
      ${left}px 100%,
      ${left}px ${top + borderRadius}px,
      ${left + borderRadius}px ${top}px,
      ${right - borderRadius}px ${top}px,
      ${right}px ${top + borderRadius}px,
      ${right}px ${bottom - borderRadius}px,
      ${right - borderRadius}px ${bottom}px,
      ${left + borderRadius}px ${bottom}px,
      ${left}px ${bottom - borderRadius}px,
      ${left}px 100%,
      100% 100%,
      100% 0%
    )`,
    background: 'rgba(0, 0, 0, 0.6)'
  }
})

// Calculate tooltip position relative to modal
function calculateTooltipPosition() {
  if (!tooltipRef.value || !overlayRef.value) return

  const tooltip = tooltipRef.value
  const tooltipRect = tooltip.getBoundingClientRect()
  const overlay = overlayRef.value
  const overlayRect = overlay.getBoundingClientRect()

  const modalWidth = overlayRect.width
  const modalHeight = overlayRect.height
  const padding = 16
  const offset = 16

  let placement = currentStep.value?.placement || 'bottom'
  let top, left

  // Center in modal for steps without target or with 'center' placement
  if (!targetRect.value || placement === 'center') {
    top = (modalHeight - tooltipRect.height) / 2
    left = (modalWidth - tooltipRect.width) / 2
    arrowPosition.value = 'none'
  } else {
    const target = targetRect.value

    // Calculate positions for each placement
    const positions = {
      top: {
        top: target.top - tooltipRect.height - offset,
        left: target.left + (target.width - tooltipRect.width) / 2,
        arrow: 'bottom'
      },
      bottom: {
        top: target.bottom + offset,
        left: target.left + (target.width - tooltipRect.width) / 2,
        arrow: 'top'
      },
      left: {
        top: target.top + (target.height - tooltipRect.height) / 2,
        left: target.left - tooltipRect.width - offset,
        arrow: 'right'
      },
      right: {
        top: target.top + (target.height - tooltipRect.height) / 2,
        left: target.right + offset,
        arrow: 'left'
      }
    }

    let pos = positions[placement] || positions.bottom

    // Check if position fits in modal viewport
    const fits = (p) => {
      if (!p) return false
      return p.top >= padding &&
        p.left >= padding &&
        p.top + tooltipRect.height <= modalHeight - padding &&
        p.left + tooltipRect.width <= modalWidth - padding
    }

    if (!fits(pos)) {
      const opposites = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
      const opposite = positions[opposites[placement]]
      if (fits(opposite)) {
        pos = opposite
        placement = opposites[placement]
      } else {
        for (const [key, value] of Object.entries(positions)) {
          if (fits(value)) {
            pos = value
            placement = key
            break
          }
        }
      }
    }

    if (!pos) {
      pos = positions.bottom
    }

    top = pos.top
    left = pos.left
    arrowPosition.value = pos.arrow

    // Clamp to modal bounds
    top = Math.max(padding, Math.min(top, modalHeight - tooltipRect.height - padding))
    left = Math.max(padding, Math.min(left, modalWidth - tooltipRect.width - padding))
  }

  tooltipPosition.value = { top, left }
}

const tooltipStyle = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`
}))

// Update positions when step changes
async function updatePositions() {
  await nextTick()
  findTarget()
  await nextTick()
  calculateTooltipPosition()
}

// Handle keyboard navigation
function handleKeydown(e) {
  if (!isActive.value) return

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      skipTour()
      break
    case 'ArrowRight':
    case 'Enter':
      e.preventDefault()
      nextStep()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (!isFirstStep.value) {
        prevStep()
      }
      break
  }
}

// Watch for step changes
watch([currentStep, isActive], () => {
  if (isActive.value) {
    // If step has waitForSelector, use MutationObserver
    if (currentStep.value?.waitForSelector) {
      const modalCard = document.querySelector('.scribe-card')
      if (modalCard) {
        const observer = new MutationObserver(() => {
          const target = modalCard.querySelector(currentStep.value.target)
          if (target) {
            observer.disconnect()
            updatePositions()
          }
        })
        observer.observe(modalCard, { childList: true, subtree: true })
        // Also try immediately in case element already exists
        updatePositions()
        // Timeout fallback
        setTimeout(() => {
          observer.disconnect()
          updatePositions()
        }, 2000)
      }
    } else {
      updatePositions()
    }
  }
}, { immediate: true })

// Setup resize observer
let resizeObserver = null

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updatePositions)

  if (overlayRef.value) {
    resizeObserver = new ResizeObserver(updatePositions)
    resizeObserver.observe(overlayRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePositions)

  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<template>
  <Transition name="scribe-tour-fade">
    <div v-if="isActive && currentStep" ref="overlayRef" class="scribe-tour-overlay">
      <!-- Backdrop with spotlight cutout -->
      <div class="scribe-tour-backdrop" :style="backdropClipPath" />

      <!-- Highlight ring around target -->
      <div
        v-if="targetRect"
        class="scribe-tour-highlight"
        :style="{
          top: `${targetRect.top - 8}px`,
          left: `${targetRect.left - 8}px`,
          width: `${targetRect.width + 16}px`,
          height: `${targetRect.height + 16}px`
        }"
      />

      <!-- Tooltip -->
      <div
        ref="tooltipRef"
        class="scribe-tour-tooltip"
        :style="tooltipStyle"
        :class="[`scribe-tour-tooltip--arrow-${arrowPosition}`]"
        role="dialog"
        aria-modal="true"
        :aria-label="currentStep.title"
      >
        <!-- Arrow -->
        <div v-if="arrowPosition !== 'none'" class="scribe-tour-tooltip__arrow" />

        <!-- Header -->
        <div class="scribe-tour-tooltip__header">
          <div v-if="currentStep.icon" class="scribe-tour-tooltip__icon">
            <Icon :name="currentStep.icon" :size="18" />
          </div>
          <h3 class="scribe-tour-tooltip__title">{{ currentStep.title }}</h3>
          <span class="scribe-tour-tooltip__counter">
            {{ currentStepIndex + 1 }}/{{ totalSteps }}
          </span>
        </div>

        <!-- Content -->
        <div class="scribe-tour-tooltip__content">
          <p>{{ currentStep.content }}</p>
        </div>

        <!-- Progress dots -->
        <div class="scribe-tour-tooltip__progress">
          <span
            v-for="i in totalSteps"
            :key="i"
            class="progress-dot"
            :class="{ active: i - 1 === currentStepIndex, completed: i - 1 < currentStepIndex }"
          />
        </div>

        <!-- Navigation -->
        <div class="scribe-tour-tooltip__nav">
          <Button variant="ghost" size="sm" class="skip-btn" @click="skipTour">
            Skip tour
          </Button>
          <div class="nav-buttons">
            <Button
              v-if="!isFirstStep"
              variant="outline"
              size="sm"
              @click="prevStep"
            >
              <Icon name="chevron-left" :size="16" />
              Back
            </Button>
            <Button variant="default" size="sm" @click="nextStep">
              {{ isLastStep ? 'Finish' : 'Next' }}
              <Icon v-if="!isLastStep" name="chevron-right" :size="16" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scribe-tour-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  overflow: hidden;
}

.scribe-tour-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  transition: clip-path 0.3s ease;
}

.scribe-tour-highlight {
  position: absolute;
  border: 2px solid hsl(var(--primary));
  border-radius: 8px;
  box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
  pointer-events: none;
  transition: all 0.3s ease;
  animation: scribe-tour-pulse 2s ease-in-out infinite;
}

@keyframes scribe-tour-pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
  }
  50% {
    box-shadow: 0 0 0 8px hsl(var(--primary) / 0.1);
  }
}

.scribe-tour-tooltip {
  position: absolute;
  width: 300px;
  max-width: calc(100% - 32px);
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  animation: scribe-tour-tooltip-enter 0.25s ease-out;
}

@keyframes scribe-tour-tooltip-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Arrow styles */
.scribe-tour-tooltip__arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transform: rotate(45deg);
}

.scribe-tour-tooltip--arrow-top .scribe-tour-tooltip__arrow {
  top: -6px;
  left: 50%;
  margin-left: -5px;
  border-bottom: none;
  border-right: none;
}

.scribe-tour-tooltip--arrow-bottom .scribe-tour-tooltip__arrow {
  bottom: -6px;
  left: 50%;
  margin-left: -5px;
  border-top: none;
  border-left: none;
}

.scribe-tour-tooltip--arrow-left .scribe-tour-tooltip__arrow {
  left: -6px;
  top: 50%;
  margin-top: -5px;
  border-top: none;
  border-right: none;
}

.scribe-tour-tooltip--arrow-right .scribe-tour-tooltip__arrow {
  right: -6px;
  top: 50%;
  margin-top: -5px;
  border-bottom: none;
  border-left: none;
}

/* Header */
.scribe-tour-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 8px;
}

.scribe-tour-tooltip__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  flex-shrink: 0;
}

.scribe-tour-tooltip__title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.scribe-tour-tooltip__counter {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

/* Content */
.scribe-tour-tooltip__content {
  padding: 8px 14px 12px;
}

.scribe-tour-tooltip__content p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: hsl(var(--foreground) / 0.9);
}

/* Progress dots */
.scribe-tour-tooltip__progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--muted));
  transition: all 0.2s ease;
}

.progress-dot.active {
  background: hsl(var(--primary));
  transform: scale(1.2);
}

.progress-dot.completed {
  background: hsl(var(--primary) / 0.5);
}

/* Navigation */
.scribe-tour-tooltip__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 14px;
  border-top: 1px solid hsl(var(--border));
}

.skip-btn {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.skip-btn:hover {
  color: hsl(var(--foreground));
}

.nav-buttons {
  display: flex;
  gap: 8px;
}

/* Transition */
.scribe-tour-fade-enter-active,
.scribe-tour-fade-leave-active {
  transition: opacity 0.2s ease;
}

.scribe-tour-fade-enter-from,
.scribe-tour-fade-leave-to {
  opacity: 0;
}

/* Dark theme adjustments */
.dark .scribe-tour-tooltip {
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.6);
}

/* High contrast theme */
.high-contrast .scribe-tour-tooltip {
  border-width: 2px;
}

.high-contrast .scribe-tour-highlight {
  border-width: 3px;
}
</style>
