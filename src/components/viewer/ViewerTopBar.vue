<script setup>
import { ref, inject } from 'vue'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon/Icon.vue'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useTheme } from '@/composables/useTheme'

// Get restartTour function from TourProvider
const restartTour = inject('restartTour', () => {})

defineProps({
  documentName: { type: String, default: 'IIIF Document' },
  leftCollapsed: { type: Boolean, default: false },
  rightCollapsed: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-left',
  'toggle-right',
  'save',
  'go-home',
  'clear-highlights',
  'clear-underlines',
  'clear-comments',
  'clear-traces',
  'clear-angles',
  'clear-horizontal',
  'clear-vertical',
  'clear-all'
])

const { currentTheme, setTheme, themes } = useTheme()

// Explicit dropdown state for debugging
const themeDropdownOpen = ref(false)
const clearDropdownOpen = ref(false)

const themeConfig = {
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
  'high-contrast': { icon: 'contrast', label: 'High Contrast' }
}

function handleThemeSelect(theme) {
  setTheme(theme)
  themeDropdownOpen.value = false
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex items-center justify-between h-full px-3 bg-card border-b border-border">
      <!-- Left: Toggle + Logo + Doc Name -->
      <div class="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Toggle toolbar" @click="emit('toggle-left')">
              <Icon name="panel-left" :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle toolbar</TooltipContent>
        </Tooltip>

        <div class="flex items-center gap-2 cursor-pointer" @click="emit('go-home')">
          <img src="@/assets/logo.png" alt="Logo" class="h-6 w-6" />
          <span class="text-sm font-medium text-foreground truncate max-w-[200px]">
            {{ documentName }}
          </span>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <!-- Save -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Save as PDF" data-tour="save-button" @click="emit('save')">
              <Icon name="save" :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Save as PDF</TooltipContent>
        </Tooltip>

        <!-- Clear Dropdown -->
        <DropdownMenu v-model:open="clearDropdownOpen">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Clear annotations" title="Clear annotations">
              <Icon name="trash-2" :size="18" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('clear-highlights'); clearDropdownOpen = false">Clear Highlights</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-underlines'); clearDropdownOpen = false">Clear Underlines</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-comments'); clearDropdownOpen = false">Clear Comments</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-traces'); clearDropdownOpen = false">Clear Traces</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-angles'); clearDropdownOpen = false">Clear Angles</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-horizontal'); clearDropdownOpen = false">Clear Horizontal Bands</DropdownMenuItem>
            <DropdownMenuItem @click="emit('clear-vertical'); clearDropdownOpen = false">Clear Vertical Bands</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive" @click="emit('clear-all'); clearDropdownOpen = false">
              Clear All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Theme Dropdown -->
        <DropdownMenu v-model:open="themeDropdownOpen">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Change theme" title="Theme">
              <Icon :name="themeConfig[currentTheme]?.icon || 'sun'" :size="18" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              v-for="theme in themes"
              :key="theme"
              @click="handleThemeSelect(theme)"
              :class="{ 'bg-primary/10 text-primary font-medium': currentTheme === theme }"
            >
              <Icon :name="themeConfig[theme]?.icon || 'sun'" :size="16" class="mr-2" />
              {{ themeConfig[theme]?.label || theme }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Help / Tour -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Help & Tour" @click="restartTour">
              <Icon name="help-circle" :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Help & Tour</TooltipContent>
        </Tooltip>

        <!-- Toggle Right Panel -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8" aria-label="Toggle panel" @click="emit('toggle-right')">
              <Icon name="panel-right" :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle panel</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>
