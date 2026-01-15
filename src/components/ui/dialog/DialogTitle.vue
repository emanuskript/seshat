<script setup>
import { computed } from 'vue'
import { DialogTitle } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: String,
})

const titleClass = computed(() => cn(
  'text-lg font-semibold leading-none tracking-tight',
  props.class
))
</script>

<template>
  <DialogTitle :class="titleClass">
    <slot />
  </DialogTitle>
</template>
