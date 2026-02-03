<script setup>
import { computed } from 'vue'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  displayName: { type: String, default: 'Anonymous' },
  color: { type: String, default: '#888888' }
})

const style = computed(() => ({
  transform: `translate(${props.x}px, ${props.y}px)`,
  '--cursor-color': props.color
}))
</script>

<template>
  <div class="participant-cursor" :style="style">
    <!-- Cursor pointer -->
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      class="cursor-pointer"
    >
      <path
        d="M5.5 3.21V20.79a1 1 0 001.66.76l4.73-4.14 3.32 7.3a1 1 0 001.32.49l2.05-.93a1 1 0 00.49-1.32l-3.32-7.3 6.16-.86a1 1 0 00.54-1.7L6.94 2.45a1 1 0 00-1.44.76z"
        :fill="color"
        :stroke="color"
        stroke-width="1.5"
      />
    </svg>

    <!-- Name label -->
    <div
      class="cursor-label"
      :style="{ backgroundColor: color }"
    >
      {{ displayName }}
    </div>
  </div>
</template>

<style scoped>
.participant-cursor {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 9998;
  transition: transform 0.1s ease-out;
}

.cursor-pointer {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.cursor-label {
  position: absolute;
  top: 18px;
  left: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
