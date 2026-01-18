<script setup>
import { computed } from 'vue'
import { DialogDescription } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: String,
})

const descriptionClass = computed(() => cn(
  'text-sm text-muted-foreground',
  props.class
))
</script>

<template>
  <DialogDescription :class="descriptionClass">
    <slot />
  </DialogDescription>
</template>
