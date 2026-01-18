<script setup>
import { DialogRoot } from 'radix-vue'

defineProps({
  open: Boolean,
  defaultOpen: Boolean,
})

const emit = defineEmits(['update:open'])
</script>

<template>
  <DialogRoot
    :open="open"
    :default-open="defaultOpen"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </DialogRoot>
</template>
