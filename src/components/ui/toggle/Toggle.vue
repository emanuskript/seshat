<script setup>
import { computed } from 'vue'
import { Toggle } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'outline'].includes(v)
  },
  size: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'sm', 'lg'].includes(v)
  },
  class: String,
  pressed: Boolean,
  disabled: Boolean,
})

const emit = defineEmits(['update:pressed'])

const variantClasses = {
  default: 'bg-transparent',
  outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
}

const sizeClasses = {
  default: 'h-10 px-3',
  sm: 'h-9 px-2.5',
  lg: 'h-11 px-5',
}

const toggleClass = computed(() => cn(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
  variantClasses[props.variant],
  sizeClasses[props.size],
  props.class
))
</script>

<template>
  <Toggle
    :class="toggleClass"
    :pressed="pressed"
    :disabled="disabled"
    @update:pressed="emit('update:pressed', $event)"
  >
    <slot />
  </Toggle>
</template>
