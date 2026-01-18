<script setup>
import { computed } from 'vue'
import { DropdownMenuItem } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: String,
  inset: Boolean,
  disabled: Boolean,
})

const emit = defineEmits(['select'])

const itemClass = computed(() => cn(
  'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  props.inset && 'pl-8',
  props.class
))

const handleSelect = (event) => {
  emit('select', event)
}
</script>

<template>
  <DropdownMenuItem
    :class="itemClass"
    :disabled="disabled"
    @select="handleSelect"
  >
    <slot />
  </DropdownMenuItem>
</template>
