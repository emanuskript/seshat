<script setup>
import { DropdownMenuRoot } from 'radix-vue'

const props = defineProps({
  open: Boolean,
  defaultOpen: Boolean,
})

const emit = defineEmits(['update:open'])
</script>

<template>
  <DropdownMenuRoot
    :open="open"
    :default-open="defaultOpen"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </DropdownMenuRoot>
</template>
