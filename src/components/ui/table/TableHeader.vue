<script setup>
import { cn } from '@/lib/utils'

defineProps({
  class: String
})
</script>

<template>
  <thead :class="cn('[&_tr]:border-b', $props.class)">
    <slot />
  </thead>
</template>
