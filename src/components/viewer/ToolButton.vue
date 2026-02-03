<script setup>
import Icon from '@/components/ui/icon/Icon.vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  shortcut: { type: String, default: '' },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  dataTourTool: { type: String, default: '' }
})

const emit = defineEmits(['click'])
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        class="h-10 w-10 flex items-center justify-center rounded-md transition-colors
               hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="{
          'bg-primary/10 text-primary': active,
          'opacity-50 cursor-not-allowed': disabled
        }"
        :aria-label="shortcut ? `${label} (${shortcut})` : label"
        :disabled="disabled"
        :data-tour-tool="dataTourTool || undefined"
        @click="!disabled && emit('click')"
      >
        <Icon :name="icon" :size="20" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="right">
      <span>{{ label }}</span>
      <span v-if="shortcut" class="ml-2 text-muted-foreground text-xs">{{ shortcut }}</span>
    </TooltipContent>
  </Tooltip>
</template>
