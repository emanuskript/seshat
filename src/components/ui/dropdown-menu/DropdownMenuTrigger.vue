<script setup>
import { DropdownMenuTrigger } from 'radix-vue'

defineProps({
  asChild: Boolean,
})
</script>

<template>
  <DropdownMenuTrigger :as-child="asChild">
    <slot />
  </DropdownMenuTrigger>
</template>
