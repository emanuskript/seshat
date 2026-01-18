<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: String,
  modelValue: {
    type: Array,
    default: () => [0]
  },
  defaultValue: {
    type: Array,
    default: () => [0]
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 1
  },
  disabled: Boolean,
  orientation: {
    type: String,
    default: 'horizontal'
  },
  dir: String,
  inverted: Boolean,
  minStepsBetweenThumbs: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['update:modelValue', 'valueCommit'])
</script>

<template>
  <SliderRoot
    :class="cn(
      'relative flex w-full touch-none select-none items-center',
      props.class
    )"
    :model-value="modelValue"
    :default-value="defaultValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :orientation="orientation"
    :dir="dir"
    :inverted="inverted"
    :min-steps-between-thumbs="minStepsBetweenThumbs"
    @update:model-value="emit('update:modelValue', $event)"
    @value-commit="emit('valueCommit', $event)"
  >
    <SliderTrack
      class="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"
    >
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, index) in modelValue"
      :key="index"
      class="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
