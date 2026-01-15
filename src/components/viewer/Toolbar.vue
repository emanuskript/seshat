<template>
  <div class="top-bar">
    <img src="@/assets/logo.png" alt="Logo" class="logo" />
    <div class="toolbar">
      <!-- Highlight -->
      <div class="toolbar-item" @click="$emit('select-tool', 'highlight')">
        <Highlighter :size="20" />
        <span>Highlight</span>
      </div>

      <!-- Underline -->
      <div class="toolbar-item" @click="$emit('select-tool', 'underline')">
        <Underline :size="20" />
        <span>Underline</span>
      </div>

      <!-- Comment -->
      <div class="toolbar-item" @click="$emit('select-tool', 'comment')">
        <MessageSquare :size="20" />
        <span>Comment</span>
      </div>

      <!-- Trace -->
      <div class="toolbar-item" @click="$emit('select-tool', 'trace')" data-tool="trace">
        <Pencil :size="20" />
        <span>Trace</span>
      </div>

      <!-- Divider -->
      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- Measure Angle -->
      <div class="toolbar-item" @click="$emit('select-tool', 'measure')" data-tool="measure">
        <ChevronUp :size="20" />
        <span>Measure</span>
        <span>Angle</span>
      </div>

      <!-- Horizontal Bands -->
      <div class="toolbar-item" @click="$emit('show-length-popup', 'horizontal')">
        <Ruler :size="20" />
        <span>Horizontal</span>
        <span>Bands</span>
      </div>

      <!-- Vertical Bands -->
      <div class="toolbar-item" @click="$emit('show-length-popup', 'vertical')">
        <RulerDimensionLine :size="20" class="rotate-90" />
        <span>Vertical</span>
        <span>Bands</span>
      </div>

      <!-- Crop -->
      <div class="toolbar-item" @click="$emit('start-crop')">
        <Scissors :size="20" />
        <span>Crop</span>
      </div>

      <!-- Divider -->
      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- Calculate menu -->
      <div class="toolbar-item calculate-container" @click.stop="$emit('toggle-calculate-dropdown')">
        <Calculator :size="20" />
        <span>Generate</span>
        <span>Statistics</span>
        <div v-if="showCalculateDropdown" class="dropdown-menu">
          <div @click.stop="$emit('calculate-current-page')">
            Lengths Measurements (Current Page)
          </div>
          <div @click.stop="$emit('calculate-entire-document')">
            Lengths Measurements (Full Document)
          </div>
          <div @click.stop="$emit('calculate-angle-statistics')">
            Angle Measurements
          </div>
        </div>
      </div>

      <!-- Save -->
      <div class="toolbar-item" @click="$emit('save-annotations')">
        <Save :size="20" />
        <span>Save</span>
      </div>

      <!-- Clear menu -->
      <div class="toolbar-item clear-container" @click.stop="$emit('toggle-clear-dropdown')">
        <Trash2 :size="20" />
        <span>Clear</span>
        <div v-if="showClearDropdown" class="dropdown-menu">
          <div @click.stop="$emit('clear-highlights')">Clear Highlights</div>
          <div @click.stop="$emit('clear-underlines')">Clear Underlines</div>
          <div @click.stop="$emit('clear-comments')">Clear Comments</div>
          <div @click.stop="$emit('clear-traces')">Clear Traces</div>
          <div @click.stop="$emit('clear-angles')">Clear Angles</div>
          <div @click.stop="$emit('clear-horizontal-lengths')">Clear Horizontal Lengths</div>
          <div @click.stop="$emit('clear-vertical-lengths')">Clear Vertical Lengths</div>
          <div @click.stop="$emit('clear-all')">Clear All</div>
        </div>
      </div>

      <!-- Divider -->
      <div class="toolbar-divider" aria-hidden="true"></div>

      <!-- Theme Toggle -->
      <div class="toolbar-item theme-container" @click.stop="toggleThemeDropdown">
        <component :is="themeIcon" :size="20" />
        <span>Theme</span>
        <div v-if="showThemeDropdown" class="dropdown-menu theme-dropdown">
          <div @click.stop="setThemeAndClose('light')" :class="{ active: currentTheme === 'light' }">
            <Sun :size="16" /> Light
          </div>
          <div @click.stop="setThemeAndClose('dark')" :class="{ active: currentTheme === 'dark' }">
            <Moon :size="16" /> Dark
          </div>
          <div @click.stop="setThemeAndClose('high-contrast')" :class="{ active: currentTheme === 'high-contrast' }">
            <Contrast :size="16" /> High Contrast
          </div>
        </div>
      </div>
    </div>

    <div class="tool-message" v-if="toolMessage">{{ toolMessage }}</div>
  </div>
</template>

<script>
import {
  Highlighter,
  Underline,
  MessageSquare,
  Pencil,
  ChevronUp,
  Ruler,
  RulerDimensionLine,
  Scissors,
  Calculator,
  Save,
  Trash2,
  Sun,
  Moon,
  Contrast,
} from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

export default {
  name: "ViewerToolbar",
  components: {
    Highlighter,
    Underline,
    MessageSquare,
    Pencil,
    ChevronUp,
    Ruler,
    RulerDimensionLine,
    Scissors,
    Calculator,
    Save,
    Trash2,
    Sun,
    Moon,
    Contrast,
  },
  props: {
    toolStates: { type: Object, default: () => ({}) },
    showCalculateDropdown: { type: Boolean, default: false },
    showClearDropdown: { type: Boolean, default: false },
    toolMessage: { type: String, default: "" },
  },
  emits: [
    "select-tool",
    "show-length-popup",
    "toggle-calculate-dropdown",
    "calculate-current-page",
    "calculate-entire-document",
    "calculate-angle-statistics",
    "save-annotations",
    "toggle-clear-dropdown",
    "clear-highlights",
    "clear-underlines",
    "clear-comments",
    "clear-traces",
    "clear-angles",
    "clear-horizontal-lengths",
    "clear-vertical-lengths",
    "clear-all",
    "start-crop",
  ],
  setup() {
    const { currentTheme, setTheme } = useTheme()
    return { currentTheme, setTheme }
  },
  data() {
    return {
      showThemeDropdown: false,
    }
  },
  computed: {
    themeIcon() {
      if (this.currentTheme === 'dark') return Moon
      if (this.currentTheme === 'high-contrast') return Contrast
      return Sun
    },
  },
  methods: {
    toggleThemeDropdown() {
      this.showThemeDropdown = !this.showThemeDropdown
    },
    setThemeAndClose(theme) {
      this.setTheme(theme)
      this.showThemeDropdown = false
    },
  },
};
</script>

<style scoped>
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: hsl(var(--background));
  border-bottom: 1px solid hsl(var(--border));
  padding: 10px 20px;
}

.logo {
  height: 60px;
}

.toolbar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--toolbar-gap, 1.5rem);
  flex: 1;
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: var(--text-xs, 12px);
  color: hsl(var(--foreground));
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--radius-md, 6px);
  transition: all 0.2s ease;
  position: relative;
}

.toolbar-item:hover {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 0.1);
}

.toolbar-divider {
  width: 1px;
  height: 32px;
  background-color: hsl(var(--border));
  margin: 0 4px;
}

.rotate-90 {
  transform: rotate(90deg);
}

/* Dropdown menus */
.calculate-container,
.clear-container,
.theme-container {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md, 6px);
  box-shadow: var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15));
  z-index: var(--z-dropdown, 100);
  min-width: 180px;
  padding: 4px 0;
  margin-top: 4px;
}

.dropdown-menu div {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.15s;
  font-size: var(--text-sm, 14px);
}

.dropdown-menu div:hover {
  background-color: hsl(var(--accent));
}

.dropdown-menu div.active {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* Tool message toast */
.tool-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 10px 20px;
  border-radius: var(--radius-md, 5px);
  z-index: var(--z-tooltip, 700);
  font-size: var(--text-sm, 14px);
  text-align: center;
  box-shadow: var(--shadow-lg, 0 4px 8px rgba(0, 0, 0, 0.2));
}
</style>
