<template>
  <Dialog :open="visible" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-md z-[60]" overlay-class="z-[60]">
      <DialogHeader>
        <DialogTitle>Choose Pen & Angle</DialogTitle>
        <DialogDescription>
          Select the pen angle and nib size for tracing.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Angle selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Angle:</label>
          <div class="flex flex-wrap justify-center gap-2">
            <Button
              v-for="ang in penAngles"
              :key="'ang-'+ang"
              :variant="selectedAngle === ang ? 'default' : 'outline'"
              size="sm"
              @click="$emit('update:selectedAngle', ang)"
            >
              {{ ang }}°
            </Button>
          </div>
        </div>

        <!-- Nib size selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Nib size:</label>
          <div class="flex flex-wrap justify-center gap-2">
            <Button
              v-for="p in penSizes"
              :key="'size-'+p.key"
              :variant="selectedSize === p.key ? 'default' : 'outline'"
              size="sm"
              @click="$emit('update:selectedSize', p.key)"
            >
              {{ p.label }}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="$emit('cancel')">Cancel</Button>
        <Button @click="$emit('confirm')">Start Tracing</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script>
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default {
  name: "TracePopup",
  components: {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Button,
  },
  props: {
    visible: { type: Boolean, default: false },
    penAngles: { type: Array, default: () => [0, 15, 30, 45, 60, 75] },
    penSizes: { type: Array, default: () => [
      { key: 'thin', label: 'Thin' },
      { key: 'medium', label: 'Medium' },
      { key: 'broad', label: 'Broad' },
    ]},
    selectedAngle: { type: Number, default: 45 },
    selectedSize: { type: String, default: 'medium' },
  },
  emits: ['update:selectedAngle', 'update:selectedSize', 'confirm', 'cancel'],
  methods: {
    handleOpenChange(open) {
      if (!open) {
        this.$emit('cancel');
      }
    },
  },
};
</script>
