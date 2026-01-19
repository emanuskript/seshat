<script setup>
import { ref, computed } from 'vue'
import Icon from '@/components/ui/icon/Icon.vue'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

const props = defineProps({
  annotations: { type: Array, default: () => [] },
  currentPage: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  zoomLevel: { type: Number, default: 1 },
  showInCm: { type: Boolean, default: false },
  selectedAnnotation: { type: Object, default: null }
})

const emit = defineEmits([
  'select-annotation',
  'delete-annotation',
  'generate-bands-page',
  'generate-bands-doc',
  'generate-angles'
])

const activeTab = ref('annotations')
const statsExpanded = ref(true)

const annotationIcons = {
  highlight: 'highlighter',
  underline: 'underline',
  trace: 'pencil',
  comment: 'message-square',
  angle: 'triangle',
  'length-h': 'ruler',
  'length-v': 'move-vertical'
}

const annotationCount = computed(() => props.annotations.length)
</script>

<template>
  <div class="flex flex-col h-full bg-card border-l border-border">
    <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
      <TabsList class="w-full justify-start rounded-none border-b bg-transparent px-2 shrink-0">
        <TabsTrigger
          value="annotations"
          class="data-[state=active]:bg-transparent data-[state=active]:shadow-none
                 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
        >
          Annotations
          <span v-if="annotationCount > 0" class="ml-1 text-xs text-muted-foreground">
            ({{ annotationCount }})
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="properties"
          class="data-[state=active]:bg-transparent data-[state=active]:shadow-none
                 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
        >
          Properties
        </TabsTrigger>
      </TabsList>

      <!-- Annotations Tab -->
      <TabsContent value="annotations" class="flex-1 overflow-y-auto p-3 mt-0">
        <div v-if="annotations.length === 0" class="text-center text-muted-foreground text-sm py-8">
          <Icon name="file-text" :size="32" class="mx-auto mb-2 opacity-50" />
          <p>No annotations yet</p>
          <p class="text-xs mt-1">Use the tools to add annotations</p>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(annotation, index) in annotations"
            :key="`${annotation.type}-${index}`"
            class="p-2 rounded-md border bg-card hover:bg-muted cursor-pointer group transition-colors"
            :class="{ 'ring-2 ring-primary': selectedAnnotation === annotation }"
            @click="emit('select-annotation', annotation)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <Icon :name="annotationIcons[annotation.type] || 'file'" :size="16" class="shrink-0" />
                <span class="text-sm truncate">{{ annotation.label }}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                @click.stop="emit('delete-annotation', annotation)"
              >
                <Icon name="trash-2" :size="14" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- Properties Tab -->
      <TabsContent value="properties" class="flex-1 overflow-y-auto p-3 mt-0">
        <div v-if="!selectedAnnotation" class="text-center text-muted-foreground text-sm py-8">
          <Icon name="settings-2" :size="32" class="mx-auto mb-2 opacity-50" />
          <p>No selection</p>
          <p class="text-xs mt-1">Select an annotation to view properties</p>
        </div>
        <div v-else class="space-y-3">
          <div class="text-sm font-medium capitalize">{{ selectedAnnotation.type }}</div>
          <div class="text-xs text-muted-foreground">
            Page {{ currentPage + 1 }}
          </div>
          <div v-if="selectedAnnotation.label" class="text-sm">
            {{ selectedAnnotation.label }}
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- Statistics Section -->
    <div class="border-t shrink-0">
      <button
        class="flex items-center justify-between w-full px-3 py-2 hover:bg-muted text-left"
        @click="statsExpanded = !statsExpanded"
      >
        <span class="text-sm font-medium">Statistics</span>
        <Icon :name="statsExpanded ? 'chevron-down' : 'chevron-right'" :size="16" />
      </button>
      <div v-show="statsExpanded" class="px-3 pb-3">
        <div class="grid grid-cols-2 gap-2 text-sm mb-3">
          <div class="p-2 rounded-md bg-muted">
            <div class="text-muted-foreground text-xs">Pages</div>
            <div class="font-medium">{{ totalPages }}</div>
          </div>
          <div class="p-2 rounded-md bg-muted">
            <div class="text-muted-foreground text-xs">Current</div>
            <div class="font-medium">{{ currentPage + 1 }}</div>
          </div>
          <div class="p-2 rounded-md bg-muted">
            <div class="text-muted-foreground text-xs">Annotations</div>
            <div class="font-medium">{{ annotationCount }}</div>
          </div>
          <div class="p-2 rounded-md bg-muted">
            <div class="text-muted-foreground text-xs">Zoom</div>
            <div class="font-medium">{{ Math.round(zoomLevel * 100) }}%</div>
          </div>
        </div>
        <div class="space-y-1">
          <Button
            variant="outline"
            size="sm"
            class="w-full justify-start"
            @click="emit('generate-bands-page')"
          >
            <Icon name="ruler" :size="14" class="mr-2" />
            Bands: Current Page
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="w-full justify-start"
            @click="emit('generate-bands-doc')"
          >
            <Icon name="ruler" :size="14" class="mr-2" />
            Bands: Entire Document
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="w-full justify-start"
            @click="emit('generate-angles')"
          >
            <Icon name="triangle" :size="14" class="mr-2" />
            Angle Measurements
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
