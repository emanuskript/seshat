<script setup>
import { DialogTrigger } from 'radix-vue'

defineProps({
  asChild: Boolean,
})
</script>

<template>
  <DialogTrigger :as-child="asChild">
    <slot />
  </DialogTrigger>
</template>
