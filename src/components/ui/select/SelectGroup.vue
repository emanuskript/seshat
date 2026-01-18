<script setup>
import { SelectGroup } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String
})
</script>

<template>
  <SelectGroup :class="cn('p-1', $props.class)">
    <slot />
  </SelectGroup>
</template>
