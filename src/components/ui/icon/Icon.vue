<script setup>
import * as icons from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 20
  },
  strokeWidth: {
    type: [Number, String],
    default: 2
  },
  class: {
    type: String,
    default: ''
  }
})

const IconComponent = computed(() => {
  // Convert kebab-case or lowercase to PascalCase
  const pascalName = props.name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  return icons[pascalName] || icons[props.name]
})
</script>

<template>
  <component
    v-if="IconComponent"
    :is="IconComponent"
    :size="size"
    :stroke-width="strokeWidth"
    :class="cn('shrink-0', props.class)"
  />
  <span v-else class="inline-block" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>
