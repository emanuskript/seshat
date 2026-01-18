<template>
  <div class="adjustments-panel">
    <div class="panel-header">
      <span class="panel-title">Image Adjustments</span>
      <Button
        variant="ghost"
        size="sm"
        @click="$emit('close')"
        class="close-btn"
      >
        <Icon name="x" :size="16" />
      </Button>
    </div>

    <div class="panel-content">
      <!-- Brightness -->
      <div class="adjustment-row">
        <div class="adjustment-label">
          <Icon name="sun" :size="16" />
          <span>Brightness</span>
        </div>
        <div class="adjustment-control">
          <Slider
            :model-value="[filters.brightness]"
            @update:model-value="v => updateFilter('brightness', v[0])"
            :min="-100"
            :max="100"
            :step="1"
            class="adjustment-slider"
          />
          <span class="adjustment-value">{{ filters.brightness }}</span>
        </div>
      </div>

      <!-- Contrast -->
      <div class="adjustment-row">
        <div class="adjustment-label">
          <Icon name="contrast" :size="16" />
          <span>Contrast</span>
        </div>
        <div class="adjustment-control">
          <Slider
            :model-value="[filters.contrast * 100]"
            @update:model-value="v => updateFilter('contrast', v[0] / 100)"
            :min="0"
            :max="300"
            :step="1"
            class="adjustment-slider"
          />
          <span class="adjustment-value">{{ Math.round(filters.contrast * 100) }}%</span>
        </div>
      </div>

      <!-- Saturation -->
      <div class="adjustment-row">
        <div class="adjustment-label">
          <Icon name="palette" :size="16" />
          <span>Saturation</span>
        </div>
        <div class="adjustment-control">
          <Slider
            :model-value="[filters.saturation * 100]"
            @update:model-value="v => updateFilter('saturation', v[0] / 100)"
            :min="0"
            :max="300"
            :step="1"
            class="adjustment-slider"
          />
          <span class="adjustment-value">{{ Math.round(filters.saturation * 100) }}%</span>
        </div>
      </div>

      <!-- Threshold (for manuscripts) -->
      <div class="adjustment-row">
        <div class="adjustment-label">
          <Icon name="scan-line" :size="16" />
          <span>Threshold</span>
          <Toggle
            :pressed="filters.threshold !== null"
            @update:pressed="v => updateFilter('threshold', v ? 128 : null)"
            class="toggle-inline"
          />
        </div>
        <div v-if="filters.threshold !== null" class="adjustment-control">
          <Slider
            :model-value="[filters.threshold]"
            @update:model-value="v => updateFilter('threshold', v[0])"
            :min="0"
            :max="255"
            :step="1"
            class="adjustment-slider"
          />
          <span class="adjustment-value">{{ filters.threshold }}</span>
        </div>
      </div>

      <!-- Toggle Options -->
      <div class="adjustment-toggles">
        <Toggle
          :pressed="filters.invert"
          @update:pressed="v => updateFilter('invert', v)"
          class="toggle-btn"
        >
          <Icon name="circle-slash" :size="16" />
          <span>Invert</span>
        </Toggle>
        <Toggle
          :pressed="filters.grayscale"
          @update:pressed="v => updateFilter('grayscale', v)"
          class="toggle-btn"
        >
          <Icon name="image-off" :size="16" />
          <span>Grayscale</span>
        </Toggle>
      </div>

      <!-- Enhancement Filters -->
      <div class="adjustment-toggles">
        <Toggle
          :pressed="filters.sharpen"
          @update:pressed="v => updateFilter('sharpen', v)"
          class="toggle-btn"
        >
          <Icon name="focus" :size="16" />
          <span>Sharpen</span>
        </Toggle>
        <Toggle
          :pressed="filters.edgeDetect"
          @update:pressed="v => updateFilter('edgeDetect', v)"
          class="toggle-btn"
        >
          <Icon name="scan" :size="16" />
          <span>Edges</span>
        </Toggle>
      </div>

      <!-- Actions -->
      <div class="panel-actions">
        <Button variant="outline" size="sm" @click="handleReset">
          Reset
        </Button>
        <Button variant="outline" size="sm" @click="handleApplyToAll">
          Apply to All
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import Icon from '@/components/ui/icon/Icon.vue'
import { useImageAdjustments } from '@/composables/useImageAdjustments'

const props = defineProps({
  totalPages: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['close', 'apply-to-all', 'filters-changed'])

const {
  currentFilters,
  setFilter,
  resetFilters,
  applyToAllPages
} = useImageAdjustments()

const filters = computed(() => currentFilters.value)

function updateFilter(key, value) {
  setFilter(key, value)
  emit('filters-changed', currentFilters.value)
}

function handleReset() {
  resetFilters()
  emit('filters-changed', currentFilters.value)
}

function handleApplyToAll() {
  applyToAllPages(props.totalPages)
  emit('apply-to-all')
}
</script>

<style scoped>
.adjustments-panel {
  position: absolute;
  top: var(--space-4, 16px);
  right: var(--space-4, 16px);
  width: 280px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
  z-index: var(--z-popover, 600);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid hsl(var(--border));
}

.panel-title {
  font-weight: var(--font-semibold, 600);
  font-size: var(--text-sm, 14px);
  color: hsl(var(--foreground));
}

.close-btn {
  padding: var(--space-1, 4px);
  height: auto;
}

.panel-content {
  padding: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.adjustment-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.adjustment-label {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-size: var(--text-sm, 14px);
  color: hsl(var(--muted-foreground));
}

.adjustment-control {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.adjustment-slider {
  flex: 1;
}

.adjustment-value {
  min-width: 48px;
  text-align: right;
  font-size: var(--text-sm, 14px);
  font-family: var(--font-mono, monospace);
  color: hsl(var(--foreground));
}

.adjustment-toggles {
  display: flex;
  gap: var(--space-2, 8px);
}

.toggle-inline {
  margin-left: auto;
  height: 24px;
  padding: 0 8px;
}

.toggle-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1, 4px);
}

.panel-actions {
  display: flex;
  gap: var(--space-2, 8px);
  padding-top: var(--space-2, 8px);
  border-top: 1px solid hsl(var(--border));
}

.panel-actions > * {
  flex: 1;
}
</style>
