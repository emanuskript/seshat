<script setup>
import { SelectLabel } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String
})
</script>

<template>
  <SelectLabel :class="cn('py-1.5 pl-8 pr-2 text-sm font-semibold', $props.class)">
    <slot />
  </SelectLabel>
</template>
