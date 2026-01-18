<script setup>
import { RadioGroupRoot } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String,
  modelValue: String,
  defaultValue: String,
  disabled: Boolean,
  orientation: {
    type: String,
    default: 'vertical',
    validator: (v) => ['vertical', 'horizontal'].includes(v)
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <RadioGroupRoot
    :class="cn(
      'grid gap-2',
      orientation === 'horizontal' && 'flex flex-wrap gap-4',
      $props.class
    )"
    :model-value="modelValue"
    :default-value="defaultValue"
    :disabled="disabled"
    :orientation="orientation"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
  </RadioGroupRoot>
</template>
