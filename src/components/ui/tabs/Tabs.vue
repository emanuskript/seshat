<script setup>
import { TabsRoot } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String,
  modelValue: String,
  defaultValue: String,
  orientation: {
    type: String,
    default: 'horizontal'
  },
  dir: String,
  activationMode: {
    type: String,
    default: 'automatic'
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <TabsRoot
    :class="cn($props.class)"
    :model-value="modelValue"
    :default-value="defaultValue"
    :orientation="orientation"
    :dir="dir"
    :activation-mode="activationMode"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
  </TabsRoot>
</template>
