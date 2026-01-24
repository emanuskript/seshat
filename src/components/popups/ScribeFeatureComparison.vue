<template>
  <div class="feature-comparison">
    <!-- View Mode Tabs -->
    <div class="flex gap-1 p-1 bg-muted rounded-lg mb-4">
      <button
        v-for="mode in viewModes"
        :key="mode.id"
        :class="[
          'flex-1 px-3 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2',
          viewMode === mode.id
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        ]"
        @click="viewMode = mode.id">
        <Icon :name="mode.icon" :size="14" />
        {{ mode.label }}
      </button>
    </div>

    <!-- Table View -->
    <div v-if="viewMode === 'table'" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left py-2 px-3 font-medium text-muted-foreground">Feature</th>
            <th v-for="scribe in scribes" :key="scribe.scribe"
                class="text-right py-2 px-3 font-medium"
                :style="{ color: getScribeColor(scribe.scribe) }">
              {{ scribe.scribe }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="feature in displayFeatures" :key="feature.key"
              class="border-b border-muted hover:bg-muted/50 transition-colors">
            <td class="py-2 px-3 text-muted-foreground">
              <div class="flex items-center gap-2">
                <span>{{ feature.label }}</span>
                <span v-if="feature.unit" class="text-xs opacity-60">({{ feature.unit }})</span>
              </div>
            </td>
            <td v-for="scribe in scribes" :key="scribe.scribe"
                class="py-2 px-3 text-right font-mono text-sm"
                :class="getValueClass(feature.key, scribe)">
              {{ formatValue(feature.key, getFeatureValue(scribe, feature.key)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Radar Chart View -->
    <div v-else-if="viewMode === 'radar'" class="max-w-lg mx-auto py-4">
      <Radar :data="radarData" :options="radarOptions" />
    </div>

    <!-- Bar Chart View -->
    <div v-else-if="viewMode === 'bar'" class="space-y-4 py-2">
      <div v-for="feature in displayFeatures.slice(0, 8)" :key="feature.key" class="px-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-muted-foreground">{{ feature.label }}</span>
        </div>
        <div class="flex gap-2">
          <div v-for="(scribe, idx) in scribes" :key="scribe.scribe" class="flex-1">
            <div class="h-6 rounded overflow-hidden bg-muted relative">
              <div
                class="h-full transition-all duration-300 rounded"
                :style="{
                  width: getBarWidth(feature.key, scribe) + '%',
                  backgroundColor: scribeColors[idx % scribeColors.length]
                }">
              </div>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-mono">
                {{ formatValue(feature.key, getFeatureValue(scribe, feature.key)) }}
              </span>
            </div>
            <div class="text-xs text-center mt-1 font-medium" :style="{ color: scribeColors[idx % scribeColors.length] }">
              {{ scribe.scribe }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border justify-center">
      <div v-for="(scribe, idx) in scribes" :key="scribe.scribe"
           class="flex items-center gap-2 text-sm">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: scribeColors[idx % scribeColors.length] }"></span>
        <span>{{ scribe.scribe }}</span>
        <span v-if="scribe.start_line && scribe.end_line" class="text-muted-foreground text-xs">
          (Lines {{ scribe.start_line }}-{{ scribe.end_line }})
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { Radar } from 'vue-chartjs'
import Icon from '@/components/ui/icon/Icon.vue'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default {
  name: 'ScribeFeatureComparison',

  components: {
    Radar,
    Icon
  },

  props: {
    scribes: {
      type: Array,
      required: true
    },
    featureNames: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      viewMode: 'table',
      viewModes: [
        { id: 'table', label: 'Table', icon: 'table' },
        { id: 'radar', label: 'Radar', icon: 'radar' },
        { id: 'bar', label: 'Bar', icon: 'bar-chart' }
      ],
      scribeColors: [
        'hsl(217, 91%, 60%)',   // Blue
        'hsl(142, 76%, 36%)',   // Green
        'hsl(38, 92%, 50%)',    // Orange
        'hsl(0, 84%, 60%)',     // Red
        'hsl(262, 83%, 58%)',   // Purple
        'hsl(175, 77%, 40%)'    // Teal
      ]
    }
  },

  computed: {
    displayFeatures() {
      return [
        { key: 'avg_stroke_width', label: 'Stroke Width', unit: 'px' },
        { key: 'stroke_width_variance', label: 'Stroke Variance', unit: null },
        { key: 'curvature_avg', label: 'Curvature', unit: null },
        { key: 'angularity_score', label: 'Angularity', unit: null },
        { key: 'letter_spacing', label: 'Letter Spacing', unit: 'px' },
        { key: 'word_spacing', label: 'Word Spacing', unit: 'px' },
        { key: 'slant_angle', label: 'Slant Angle', unit: 'deg' },
        { key: 'slant_consistency', label: 'Slant Consistency', unit: null },
        { key: 'pressure_avg', label: 'Pressure', unit: null },
        { key: 'pressure_variance', label: 'Pressure Variance', unit: null },
        { key: 'letter_height_avg', label: 'Letter Height', unit: 'px' },
        { key: 'letter_height_variance', label: 'Height Variance', unit: null },
        { key: 'baseline_straightness', label: 'Baseline Straightness', unit: null }
      ]
    },

    radarData() {
      const labels = this.displayFeatures.slice(0, 8).map(f => f.label)
      const datasets = this.scribes.map((scribe, idx) => ({
        label: scribe.scribe,
        data: this.displayFeatures.slice(0, 8).map(f =>
          this.normalizeValue(f.key, this.getFeatureValue(scribe, f.key))
        ),
        backgroundColor: this.hexToRgba(this.scribeColors[idx % this.scribeColors.length], 0.2),
        borderColor: this.scribeColors[idx % this.scribeColors.length],
        borderWidth: 2,
        pointBackgroundColor: this.scribeColors[idx % this.scribeColors.length],
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: this.scribeColors[idx % this.scribeColors.length]
      }))

      return { labels, datasets }
    },

    radarOptions() {
      return {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 25,
              display: true,
              backdropColor: 'transparent',
              color: 'hsl(var(--muted-foreground))'
            },
            grid: {
              color: 'hsl(var(--border))'
            },
            angleLines: {
              color: 'hsl(var(--border))'
            },
            pointLabels: {
              color: 'hsl(var(--foreground))',
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'hsl(var(--foreground))',
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'hsl(var(--popover))',
            titleColor: 'hsl(var(--popover-foreground))',
            bodyColor: 'hsl(var(--popover-foreground))',
            borderColor: 'hsl(var(--border))',
            borderWidth: 1
          }
        }
      }
    }
  },

  methods: {
    getFeatureValue(scribe, key) {
      if (!scribe.features || !scribe.features[key]) return null
      const value = scribe.features[key]
      return typeof value === 'object' ? value.mean : value
    },

    getScribeColor(scribeName) {
      const idx = this.scribes.findIndex(s => s.scribe === scribeName)
      return this.scribeColors[idx % this.scribeColors.length]
    },

    normalizeValue(key, value) {
      if (value == null) return 0

      const ranges = {
        slant_angle: { min: -45, max: 45 },
        slant_consistency: { min: 0, max: 1 },
        baseline_straightness: { min: 0, max: 1 },
        pressure_avg: { min: 0, max: 1 },
        pressure_variance: { min: 0, max: 0.5 },
        curvature_avg: { min: 0, max: 1 },
        angularity_score: { min: 0, max: 1 },
        avg_stroke_width: { min: 0, max: 10 },
        stroke_width_variance: { min: 0, max: 5 },
        letter_spacing: { min: 0, max: 30 },
        word_spacing: { min: 0, max: 60 },
        letter_height_avg: { min: 0, max: 50 },
        letter_height_variance: { min: 0, max: 20 }
      }

      const range = ranges[key] || { min: 0, max: Math.max(Math.abs(value) * 2, 10) }
      let normalized

      if (key === 'slant_angle') {
        // For slant angle, normalize absolute value
        normalized = (Math.abs(value) / range.max) * 100
      } else {
        normalized = ((value - range.min) / (range.max - range.min)) * 100
      }

      return Math.min(100, Math.max(0, normalized))
    },

    formatValue(key, value) {
      if (value == null) return 'N/A'

      if (key.includes('angle')) return `${Math.round(value)}\u00B0`
      if (key.includes('width') || key.includes('height') || key.includes('spacing')) {
        return `${value.toFixed(1)}`
      }
      if (key.includes('straightness') || key.includes('consistency')) {
        return `${(value * 100).toFixed(0)}%`
      }
      if (key.includes('pressure') || key.includes('curvature') || key.includes('angularity')) {
        return value.toFixed(2)
      }
      return value.toFixed(2)
    },

    getValueClass(/* key, scribe */) {
      // Could add highlighting for significant differences
      return ''
    },

    getBarWidth(key, scribe) {
      return this.normalizeValue(key, this.getFeatureValue(scribe, key))
    },

    hexToRgba(hslColor, alpha) {
      // For HSL colors, just return with alpha
      if (hslColor.startsWith('hsl')) {
        return hslColor.replace('hsl', 'hsla').replace(')', `, ${alpha})`)
      }
      return hslColor
    }
  }
}
</script>

<style scoped>
.feature-comparison {
  @apply w-full;
}

table {
  border-collapse: collapse;
}

th, td {
  white-space: nowrap;
}
</style>
