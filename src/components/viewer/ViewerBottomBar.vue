<script setup>
import { ref, watch, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import Icon from '@/components/ui/icon/Icon.vue'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const props = defineProps({
  currentPage: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  zoomLevel: { type: Number, default: 1 },
  minZoom: { type: Number, default: 0.5 },
  maxZoom: { type: Number, default: 15 },
  showInCm: { type: Boolean, default: false },
  imageReady: { type: Boolean, default: false }
})

const emit = defineEmits([
  'prev-page',
  'next-page',
  'go-to-page',
  'zoom-in',
  'zoom-out',
  'zoom-to',
  'reset-zoom',
  'toggle-units',
  'start-hold-reset',
  'cancel-hold-reset'
])

const localPageInput = ref(props.currentPage + 1)
const zoomSlider = ref([props.zoomLevel])

watch(() => props.currentPage, (val) => {
  localPageInput.value = val + 1
})

watch(() => props.zoomLevel, (val) => {
  zoomSlider.value = [val]
})

const zoomPercentage = computed(() => Math.round(props.zoomLevel * 100))

function handlePageInput() {
  const page = parseInt(localPageInput.value, 10)
  if (!isNaN(page) && page >= 1 && page <= props.totalPages) {
    emit('go-to-page', page)
  } else {
    localPageInput.value = props.currentPage + 1
  }
}

function handleZoomSlider(val) {
  emit('zoom-to', val[0])
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex items-center justify-between h-full px-3 bg-muted/50 border-t border-border">
      <!-- Left: Zoom Controls -->
      <div class="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              aria-label="Zoom out (hold 3s to reset)"
              :disabled="!imageReady"
              @click="emit('zoom-out')"
              @mousedown="emit('start-hold-reset')"
              @mouseup="emit('cancel-hold-reset')"
              @mouseleave="emit('cancel-hold-reset')"
            >
              <Icon name="minus" :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom out (hold 3s to reset)</TooltipContent>
        </Tooltip>

        <Slider
          v-model="zoomSlider"
          :min="minZoom"
          :max="maxZoom"
          :step="0.1"
          :disabled="!imageReady"
          class="w-24"
          @update:model-value="handleZoomSlider"
        />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              aria-label="Zoom in"
              :disabled="!imageReady"
              @click="emit('zoom-in')"
            >
              <Icon name="plus" :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="text-xs font-medium px-2 py-1 rounded hover:bg-accent min-w-[50px]"
              aria-label="Reset zoom to fit view"
              :disabled="!imageReady"
              @click="emit('reset-zoom')"
            >
              {{ zoomPercentage }}%
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Reset zoom (fit to view)</TooltipContent>
        </Tooltip>
      </div>

      <!-- Center: Page Navigation -->
      <div class="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              aria-label="Previous page"
              :disabled="currentPage === 0"
              @click="emit('prev-page')"
            >
              <Icon name="chevron-left" :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Previous page</TooltipContent>
        </Tooltip>

        <div class="flex items-center gap-1 text-sm">
          <Input
            v-model="localPageInput"
            type="text"
            class="w-12 h-6 text-center text-sm px-1"
            @blur="handlePageInput"
            @keydown.enter="handlePageInput"
          />
          <span class="text-muted-foreground">/</span>
          <span class="text-muted-foreground">{{ totalPages }}</span>
        </div>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              aria-label="Next page"
              :disabled="currentPage >= totalPages - 1"
              @click="emit('next-page')"
            >
              <Icon name="chevron-right" :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Next page</TooltipContent>
        </Tooltip>
      </div>

      <!-- Right: Unit Toggle -->
      <div class="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="text-xs font-medium px-2 py-1 rounded hover:bg-accent border border-border"
              aria-label="Toggle measurement unit"
              @click="emit('toggle-units')"
            >
              {{ showInCm ? 'cm' : 'px' }}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Toggle measurement unit</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>
