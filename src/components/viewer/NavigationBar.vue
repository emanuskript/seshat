<template>
  <div class="navigation-bar">
    <!-- Zoom Out Button (Far Left) -->
    <button
      v-if="imageReady"
      class="zoom-btn"
      :disabled="zoomLevel <= minZoom"
      @click="$emit('zoom-out')"
      @mousedown="$emit('start-hold-reset')"
      @mouseup="$emit('cancel-hold-reset')"
      @mouseleave="$emit('cancel-hold-reset')"
      title="Zoom Out (hold 3s to reset)"
    >
      <Minus :size="16" />
    </button>

    <!-- Center Navigation Group -->
    <div class="nav-center">
      <button
        :disabled="currentPage <= 0"
        @click="$emit('prev')"
        aria-label="Previous page"
        class="nav-btn"
      >
        <ChevronLeft :size="16" />
        Prev
      </button>

      <div class="page-input-container">
        <label for="pageInput">Page:</label>
        <input
          id="pageInput"
          type="number"
          v-model.number="localPageInput"
          :max="totalPages"
          :min="1"
          @blur="emitGoTo"
          @keyup.enter="emitGoTo"
          aria-label="Go to page"
        />
        <span>/ {{ totalPages }}</span>
      </div>

      <button
        :disabled="currentPage >= totalPages - 1"
        @click="$emit('next')"
        aria-label="Next page"
        class="nav-btn"
      >
        Next
        <ChevronRight :size="16" />
      </button>
    </div>

    <!-- Zoom In Button (Far Right) -->
    <button
      v-if="imageReady"
      class="zoom-btn"
      @click="$emit('zoom-in')"
      title="Zoom In (+10%)"
    >
      <Plus :size="16" />
    </button>
  </div>
</template>

<script>
import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-vue-next'

export default {
  name: "NavigationBar",
  components: {
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
  },
  props: {
    currentPage: { type: Number, required: true }, // 0-based
    totalPages: { type: Number, required: true },
    pageInput: { type: Number, required: true }, // 1-based
    imageReady: { type: Boolean, default: false },
    zoomLevel: { type: Number, default: 1 },
    minZoom: { type: Number, default: 1 },
  },
  emits: ["prev", "next", "go-to", "zoom-in", "zoom-out", "start-hold-reset", "cancel-hold-reset"],
  data() {
    return {
      localPageInput: this.pageInput,
    };
  },
  watch: {
    pageInput(newVal) {
      this.localPageInput = newVal;
    },
  },
  methods: {
    emitGoTo() {
      const clamped = Math.max(1, Math.min(this.localPageInput || 1, this.totalPages || 1));
      this.localPageInput = clamped;
      this.$emit("go-to", clamped);
    },
  },
};
</script>

<style scoped>
.navigation-bar {
  background: hsl(var(--muted));
  border-bottom: 1px solid hsl(var(--border));
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 5px 0;
  font-family: var(--font-sans, "Arial", "Helvetica", sans-serif);
  font-size: var(--text-sm, 13px);
}

.nav-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.navigation-bar > * {
  margin-top: 8px;
}

.page-input-container {
  display: flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--foreground));
}

.page-input-container input {
  width: 45px;
  text-align: center;
  padding: 4px 6px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm, 4px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  font-size: var(--text-xs, 12px);
}

.page-input-container input:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-size: var(--text-xs, 12px);
  border: none;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: var(--shadow-sm, 0 1px 0 rgba(0,0,0,0.06));
  transition: all 0.2s ease;
}

.nav-btn:hover {
  filter: brightness(0.9);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid hsl(var(--primary));
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  user-select: none;
}

.zoom-btn:hover {
  filter: brightness(0.9);
  transform: scale(1.05);
}

.zoom-btn:active {
  transform: scale(0.95);
}

.zoom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
</style>
