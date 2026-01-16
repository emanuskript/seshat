<template>
  <!-- Compact, anchored panel (old layout restored) -->
  <aside class="bank" :class="{ 'bank--blurred': isBlurred }">
    <header class="bank__header">
      <span class="bank__title">Annotations — Page {{ page + 1 }}</span>
      <div class="header-controls">
        <div class="zoom-indicator">{{ Math.round(zoomLevel * 100) }}%</div>
        <div class="unit-toggle" @click="toggleUnits" :title="`Switch to ${showInCm ? 'pixels' : 'centimeters'}`">
          <div class="toggle-switch" :class="{ active: showInCm }">
            <div class="toggle-slider"></div>
          </div>
          <span class="unit-label">{{ showInCm ? 'cm' : 'px' }}</span>
        </div>
      </div>
    </header>

    <!-- Items -->
    <section class="bank__list" v-if="items && items.length">
      <div
        v-for="item in items"
        :key="item.key"
        class="bank__row"
        :class="{ 'bank__row--selected': selectedKeys.includes(item.key) }"
        @click="toggle(item.key)"
      >
        <!-- keep color as-is (old colors) -->
        <span
          v-if="item.color"
          class="bank__dot"
          :style="{ backgroundColor: item.color }"
          aria-hidden="true"
        />
        <div class="bank__text">
          <div class="bank__title-line">
            <span class="bank__row-title">{{ item.title }}</span>
            <span class="bank__badge" v-if="item.category">{{ pretty(item.category) }}</span>
          </div>
          <div class="bank__subtitle" v-if="item.subtitle">{{ item.subtitle }}</div>
        </div>
      </div>
    </section>

    <section v-else class="bank__empty">
      No annotations on this page.
    </section>

    <!-- Footer controls (Move / Delete back; Single/Multi kept, styled) -->
    <footer class="bank__footer">
      <button class="bank__btn" @click="$emit('toggle-multi')">
        {{ multiSelect ? 'Multi-select' : 'Single-select' }}
      </button>
      <button
        class="bank__btn bank__btn--primary"
        :disabled="!selectedKeys.length"
        @click="$emit('request-move')"
      >
        Move
      </button>
      <button
        class="bank__btn bank__btn--danger"
        :disabled="!selectedKeys.length"
        @click="$emit('request-delete')"
      >
        Delete
      </button>
    </footer>
  </aside>
</template>

<script>
export default {
  name: "AnnotationsBank",
  props: {
    page: { type: Number, required: true },
    items: { type: Array, default: () => [] },
    selectedKeys: { type: Array, default: () => [] },
    multiSelect: { type: Boolean, default: true },
    moveActive: { type: Boolean, default: false },
    zoomLevel: { type: Number, default: 1 },
    showInCm: { type: Boolean, default: false },
    pixelsPerCm: { type: Number, default: 37.8 }, // Approximate conversion: 96 DPI = 37.8 pixels per cm
    isBlurred: { type: Boolean, default: false },
  },
  emits: ["update:selected", "toggle-multi", "request-move", "cancel-move", "request-delete", "toggle-units"],
  methods: {
    toggle(key) {
      console.log('Toggle called with key:', key, 'Current selection:', this.selectedKeys);
      const set = new Set(this.selectedKeys);
      if (set.has(key)) {
        set.delete(key);
      } else {
        if (this.multiSelect) {
          set.add(key);
        } else {
          // Single select mode: clear all others and add this one
          set.clear();
          set.add(key);
        }
      }
      const newSelection = Array.from(set);
      console.log('Emitting new selection:', newSelection);
      this.$emit("update:selected", newSelection);
    },
    pretty(cat) {
      return String(cat)
        .replace(/_/g, " ")
        .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
    },
    toggleUnits() {
      this.$emit("toggle-units");
    },
  },
};
</script>

<style scoped>
/* Themed annotations bank panel */

/* anchored, compact */
.bank{
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 260px;
  max-height: 52vh;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-lg, 0 10px 26px rgba(0,0,0,.18));
  overflow: hidden;
  z-index: 2000 !important; /* Below all popups but above stage */
  font-size: 12px;
  transition: filter 0.2s ease, opacity 0.2s ease, z-index 0s;
}

.bank--blurred {
  filter: blur(3px);
  opacity: 0.5;
  pointer-events: none;
  z-index: 1000 !important; /* Even lower when blurred */
}

/* header (thin like old) */
.bank__header{
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bank__title{ font-weight: 600; color: hsl(var(--foreground)); }

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-indicator {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.unit-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.toggle-switch {
  position: relative;
  width: 32px;
  height: 16px;
  background: hsl(var(--muted));
  border-radius: 16px;
  transition: background-color 0.3s ease;
}

.toggle-switch.active {
  background: hsl(var(--primary));
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: hsl(var(--background));
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-slider {
  transform: translateX(16px);
}

.unit-label {
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--foreground));
  min-width: 16px;
}

/* list */
.bank__list{ overflow: auto; padding: 6px; }
.bank__row{
  display:flex; gap:8px; align-items:flex-start;
  padding:7px 8px; border-radius:10px; cursor:pointer; user-select:none;
  transition: background 0.15s ease;
}
.bank__row:hover{ background: hsl(var(--primary) / 0.08); }
.bank__row--selected{
  outline: 2px solid hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.12);
}
.bank__dot{
  width:10px; height:10px; border-radius:999px; margin-top:3px;
  border:1px solid rgba(0,0,0,.15); flex:none;
}
.bank__text{ flex:1; min-width:0; }
.bank__title-line{ display:flex; align-items:center; gap:6px; }
.bank__row-title{ font-weight:600; font-size:12px; line-height:1.15; color: hsl(var(--foreground)); }
.bank__badge{
  font-size:10px; background: hsl(var(--primary) / 0.1); border:1px solid hsl(var(--primary) / 0.3); color: hsl(var(--primary));
  padding:2px 6px; border-radius:999px;
}
.bank__subtitle{
  font-size:11px; color: hsl(var(--muted-foreground)); opacity:.9; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* empty */
.bank__empty{ padding:16px 10px; color: hsl(var(--muted-foreground)); text-align:center; }

/* footer (themed buttons) */
.bank__footer{
  display:flex; gap:8px; padding:8px; border-top:1px solid hsl(var(--border));
  background: hsl(var(--card));
}
.bank__btn{
  flex:1; appearance:none; border:1px solid hsl(var(--border)); background: hsl(var(--muted));
  color: hsl(var(--foreground)); font-weight:600; padding:6px 6px; border-radius:8px; cursor:pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-size: 11px;
  min-width: 0;
}
.bank__btn:hover{ filter: brightness(0.95); }
.bank__btn:disabled{ opacity:.5; cursor:not-allowed; }

.bank__btn--primary{
  background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));
}
.bank__btn--primary:hover{ filter: brightness(0.9); }

.bank__btn--danger{
  background: hsl(var(--destructive)); border-color: hsl(var(--destructive)); color: hsl(var(--destructive-foreground));
}
.bank__btn--danger:hover{ filter: brightness(0.9); }
</style>
