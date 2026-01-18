<script setup>
import { cn } from '@/lib/utils'

defineProps({
  class: String
})
</script>

<template>
  <div
    :class="cn('w-px h-8 bg-border mx-2', $props.class)"
    role="separator"
    aria-orientation="vertical"
  />
</template>
