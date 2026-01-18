<script setup>
import { computed } from 'vue'
import { DropdownMenuSeparator } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: String,
})

const separatorClass = computed(() => cn(
  '-mx-1 my-1 h-px bg-muted',
  props.class
))
</script>

<template>
  <DropdownMenuSeparator :class="separatorClass" />
</template>
