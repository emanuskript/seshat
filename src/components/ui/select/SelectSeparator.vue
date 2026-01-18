<script setup>
import { SelectSeparator } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String
})
</script>

<template>
  <SelectSeparator :class="cn('-mx-1 my-1 h-px bg-muted', $props.class)" />
</template>
