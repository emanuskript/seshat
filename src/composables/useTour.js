import { ref, computed, watch, readonly } from 'vue'
import { tourSteps } from '@/data/tourSteps'

const TOUR_STORAGE_KEY = 'quillapp-tour'

// Module-level state (singleton pattern - shared across all components)
const isActive = ref(false)
const currentStepIndex = ref(0)
const hasSeenTour = ref(false)
const isPaused = ref(false)

export function useTour() {
  // --- Computed ---
  const currentStep = computed(() =>
    isActive.value ? tourSteps[currentStepIndex.value] : null
  )

  const totalSteps = computed(() => tourSteps.length)

  const isFirstStep = computed(() => currentStepIndex.value === 0)
  const isLastStep = computed(() => currentStepIndex.value === totalSteps.value - 1)

  const progress = computed(() =>
    ((currentStepIndex.value + 1) / totalSteps.value) * 100
  )

  // --- Actions ---
  function startTour() {
    currentStepIndex.value = 0
    isActive.value = true
    isPaused.value = false
  }

  function nextStep() {
    if (currentStepIndex.value < totalSteps.value - 1) {
      currentStepIndex.value++
    } else {
      completeTour()
    }
  }

  function prevStep() {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value--
    }
  }

  function goToStep(index) {
    if (index >= 0 && index < totalSteps.value) {
      currentStepIndex.value = index
    }
  }

  function skipTour() {
    isActive.value = false
    hasSeenTour.value = true
    persistTourState({ skipped: true })
  }

  function completeTour() {
    isActive.value = false
    hasSeenTour.value = true
    persistTourState({ completed: true })
  }

  function pauseTour() {
    isPaused.value = true
  }

  function resumeTour() {
    isPaused.value = false
  }

  function resetTour() {
    currentStepIndex.value = 0
    hasSeenTour.value = false
    isActive.value = false
    clearTourStorage()
  }

  // --- Persistence ---
  function persistTourState(options = {}) {
    try {
      const state = {
        hasSeenTour: hasSeenTour.value,
        completed: options.completed || false,
        skipped: options.skipped || false,
        lastStep: currentStepIndex.value,
        timestamp: Date.now()
      }
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Could not persist tour state:', e)
    }
  }

  function loadTourState() {
    try {
      const saved = localStorage.getItem(TOUR_STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved)
        hasSeenTour.value = state.hasSeenTour || state.completed || state.skipped || false

        // Optionally resume from last step if tour was interrupted
        if (!state.completed && !state.skipped && state.lastStep > 0) {
          currentStepIndex.value = state.lastStep
        }
      }
    } catch (e) {
      console.warn('Could not load tour state:', e)
    }
  }

  function clearTourStorage() {
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY)
    } catch (e) {
      console.warn('Could not clear tour storage:', e)
    }
  }

  // Watch for step changes to persist progress (only while tour is active)
  watch(currentStepIndex, () => {
    if (isActive.value) {
      persistTourState()
    }
  })

  return {
    // State (readonly to prevent external mutation)
    isActive: readonly(isActive),
    currentStep,
    currentStepIndex: readonly(currentStepIndex),
    totalSteps,
    isFirstStep,
    isLastStep,
    progress,
    hasSeenTour: readonly(hasSeenTour),
    isPaused: readonly(isPaused),

    // Actions
    startTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    completeTour,
    pauseTour,
    resumeTour,
    resetTour,
    loadTourState,
  }
}
