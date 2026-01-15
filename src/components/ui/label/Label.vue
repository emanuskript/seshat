<script setup>
import { Label as LabelPrimitive } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String,
  for: String
})
</script>

<template>
  <LabelPrimitive
    :class="cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      $props.class
    )"
    :for="$props.for"
  >
    <slot />
  </LabelPrimitive>
</template>
