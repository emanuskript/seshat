<script setup>
import { SelectRoot } from 'radix-vue'

defineProps({
  modelValue: String,
  defaultValue: String,
  open: Boolean,
  defaultOpen: Boolean,
  disabled: Boolean,
  name: String,
  dir: String
})

const emit = defineEmits(['update:modelValue', 'update:open'])
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :open="open"
    :default-open="defaultOpen"
    :disabled="disabled"
    :name="name"
    :dir="dir"
    @update:model-value="emit('update:modelValue', $event)"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </SelectRoot>
</template>
