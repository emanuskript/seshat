<script setup>
import { ref, watch, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { useTour } from '@/composables/useTour'
import TourSpotlight from './TourSpotlight.vue'
import TourWelcome from './TourWelcome.vue'

const route = useRoute()
const tour = useTour()
const {
  isActive,
  currentStep,
  loadTourState,
  startTour,
  hasSeenTour
} = tour

const showWelcome = ref(false)
const isViewerReady = ref(false)

// Provide tour context to child components
provide('tour', tour)

// Load tour state on mount
onMounted(() => {
  loadTourState()
})

// Watch for route changes to show welcome dialog on viewer page
watch(
  [() => route.name, hasSeenTour],
  ([routeName, seen]) => {
    if (routeName === 'IIIFViewer' && !seen) {
      // Delay to let viewer initialize fully
      setTimeout(() => {
        isViewerReady.value = true
        showWelcome.value = true
      }, 1500)
    } else {
      showWelcome.value = false
      isViewerReady.value = routeName === 'IIIFViewer'
    }
  },
  { immediate: true }
)

function handleStartTour() {
  showWelcome.value = false
  // Small delay to ensure welcome dialog is closed
  setTimeout(() => {
    startTour()
  }, 100)
}

function handleSkipWelcome() {
  showWelcome.value = false
}

// Expose method to restart tour (for help button)
function restartTour() {
  if (route.name === 'IIIFViewer') {
    startTour()
  }
}

// Provide restartTour to descendants
provide('restartTour', restartTour)
</script>

<template>
  <div class="tour-provider">
    <slot />

    <!-- Welcome Dialog (only on viewer page for new visitors) -->
    <TourWelcome
      v-if="showWelcome && isViewerReady"
      @start="handleStartTour"
      @skip="handleSkipWelcome"
    />

    <!-- Active Tour Spotlight -->
    <TourSpotlight
      v-if="isActive && currentStep && isViewerReady"
      :step="currentStep"
    />
  </div>
</template>

<style scoped>
.tour-provider {
  /* Wrapper doesn't add any visual styling */
  display: contents;
}
</style>
