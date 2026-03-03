<script setup>
import { DropdownMenuLabel } from 'radix-vue'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <DropdownMenuLabel
    v-bind="$attrs"
    class="px-2 py-1.5 text-sm font-semibold text-foreground"
  >
    <slot />
  </DropdownMenuLabel>
</template>
