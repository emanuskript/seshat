<script setup>
import { TabsContent } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps({
  class: String,
  value: {
    type: String,
    required: true
  }
})
</script>

<template>
  <TabsContent
    :class="cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      $props.class
    )"
    :value="value"
  >
    <slot />
  </TabsContent>
</template>
