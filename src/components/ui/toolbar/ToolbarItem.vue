<script setup>
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

defineProps({
  icon: String,
  label: String,
  sublabel: String,
  active: Boolean,
  disabled: Boolean,
  class: String
})

defineEmits(['click'])
</script>

<template>
  <button
    type="button"
    :class="cn(
      'flex flex-col items-center gap-0.5 px-2 py-1 rounded-md cursor-pointer transition-colors',
      'text-foreground hover:text-primary',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      active && 'text-primary bg-primary/10',
      disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
      $props.class
    )"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <Icon v-if="icon" :name="icon" :size="20" />
    <span class="text-xs leading-tight">{{ label }}</span>
    <span v-if="sublabel" class="text-xs leading-tight">{{ sublabel }}</span>
  </button>
</template>
