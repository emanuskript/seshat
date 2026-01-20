<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useTour } from '@/composables/useTour'
import TourNavigation from './TourNavigation.vue'
import TourProgress from './TourProgress.vue'
import Icon from '@/components/ui/icon/Icon.vue'

const props = defineProps({
  step: {
    type: Object,
    required: true
  },
  targetRect: {
    type: Object,
    default: null
  }
})

const { currentStepIndex, totalSteps } = useTour()

const tooltipRef = ref(null)
const tooltipPosition = ref({ top: 0, left: 0 })
const arrowPosition = ref('bottom')

function calculatePosition() {
  if (!tooltipRef.value) return

  const tooltip = tooltipRef.value
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const padding = 16
  const offset = 12

  let placement = props.step.placement || 'bottom'
  let top, left

  // Center in viewport for steps without target or with 'center' placement
  if (!props.targetRect || placement === 'center') {
    top = (viewportHeight - tooltipRect.height) / 2
    left = (viewportWidth - tooltipRect.width) / 2
    arrowPosition.value = 'none'
  } else {
    const target = props.targetRect

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

    // Use preferred placement if it fits, otherwise find best fit
    let pos = positions[placement] || positions.bottom

    // Check if position fits in viewport
    const fits = (p) => {
      if (!p) return false
      return p.top >= padding &&
        p.left >= padding &&
        p.top + tooltipRect.height <= viewportHeight - padding &&
        p.left + tooltipRect.width <= viewportWidth - padding
    }

    if (!fits(pos)) {
      // Try opposite placement first
      const opposites = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
      const opposite = positions[opposites[placement]]
      if (fits(opposite)) {
        pos = opposite
        placement = opposites[placement]
      } else {
        // Find first fitting placement
        for (const [key, value] of Object.entries(positions)) {
          if (fits(value)) {
            pos = value
            placement = key
            break
          }
        }
      }
    }

    // Fallback to bottom if still no valid position
    if (!pos) {
      pos = positions.bottom
    }

    top = pos.top
    left = pos.left
    arrowPosition.value = pos.arrow

    // Clamp to viewport bounds
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding))
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding))
  }

  tooltipPosition.value = { top, left }
}

const tooltipStyle = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`,
}))

// Recalculate on mount and when props change
onMounted(async () => {
  await nextTick()
  calculatePosition()
})

watch([() => props.step, () => props.targetRect], async () => {
  await nextTick()
  calculatePosition()
})
</script>

<template>
  <div
    ref="tooltipRef"
    class="tour-tooltip"
    :style="tooltipStyle"
    :class="[`tour-tooltip--arrow-${arrowPosition}`]"
  >
    <!-- Arrow -->
    <div v-if="arrowPosition !== 'none'" class="tour-tooltip__arrow" />

    <!-- Header -->
    <div class="tour-tooltip__header">
      <div v-if="step.icon" class="tour-tooltip__icon">
        <Icon :name="step.icon" :size="20" />
      </div>
      <h3 class="tour-tooltip__title">{{ step.title }}</h3>
      <span class="tour-tooltip__counter">
        {{ currentStepIndex + 1 }}/{{ totalSteps }}
      </span>
    </div>

    <!-- Content -->
    <div class="tour-tooltip__content">
      <p>{{ step.content }}</p>

      <!-- Optional tip -->
      <div v-if="step.tip" class="tour-tooltip__tip">
        <Icon name="lightbulb" :size="14" />
        <span>{{ step.tip }}</span>
      </div>
    </div>

    <!-- Progress dots -->
    <TourProgress />

    <!-- Navigation -->
    <TourNavigation />
  </div>
</template>

<style scoped>
.tour-tooltip {
  position: fixed;
  z-index: 10000;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  pointer-events: auto;
  animation: tour-tooltip-enter 0.2s ease-out;
}

@keyframes tour-tooltip-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Arrow styles */
.tour-tooltip__arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transform: rotate(45deg);
}

.tour-tooltip--arrow-top .tour-tooltip__arrow {
  top: -7px;
  left: 50%;
  margin-left: -6px;
  border-bottom: none;
  border-right: none;
}

.tour-tooltip--arrow-bottom .tour-tooltip__arrow {
  bottom: -7px;
  left: 50%;
  margin-left: -6px;
  border-top: none;
  border-left: none;
}

.tour-tooltip--arrow-left .tour-tooltip__arrow {
  left: -7px;
  top: 50%;
  margin-top: -6px;
  border-top: none;
  border-right: none;
}

.tour-tooltip--arrow-right .tour-tooltip__arrow {
  right: -7px;
  top: 50%;
  margin-top: -6px;
  border-bottom: none;
  border-left: none;
}

/* Header */
.tour-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 8px;
}

.tour-tooltip__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  flex-shrink: 0;
}

.tour-tooltip__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.tour-tooltip__counter {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

/* Content */
.tour-tooltip__content {
  padding: 12px 16px;
}

.tour-tooltip__content p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.tour-tooltip__tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: hsl(var(--muted));
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.tour-tooltip__tip svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--primary));
}

/* Dark theme adjustments */
.dark .tour-tooltip {
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3);
}

/* High contrast theme */
.high-contrast .tour-tooltip {
  border-width: 2px;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .tour-tooltip {
    width: calc(100vw - 24px);
    max-width: none;
    left: 12px !important;
    right: 12px;
  }

  .tour-tooltip__header {
    padding: 12px;
  }

  .tour-tooltip__content {
    padding: 12px;
  }

  .tour-tooltip__arrow {
    display: none;
  }
}
</style>
