import { ref, computed, watch, readonly } from 'vue'
import { getStepsForBranch } from '@/data/scribeTourSteps'

const SCRIBE_TOUR_STORAGE_KEY = 'quillapp-scribe-tour'

// Module-level state (singleton pattern - shared across all components)
const isActive = ref(false)
const currentBranch = ref('common') // 'common' | 'auto' | 'manual' | 'json' | 'step2'
const currentStepIndex = ref(0)
const hasSeenScribeTour = ref(false)
const modalContainer = ref(null) // Reference to the modal card element

export function useScribeTour() {
  // --- Computed ---
  // Get steps for the current branch (common steps + branch-specific steps)
  const currentSteps = computed(() => {
    return getStepsForBranch(currentBranch.value)
  })

  const currentStep = computed(() =>
    isActive.value && currentSteps.value[currentStepIndex.value]
      ? currentSteps.value[currentStepIndex.value]
      : null
  )

  const totalSteps = computed(() => currentSteps.value.length)

  const isFirstStep = computed(() => currentStepIndex.value === 0)
  const isLastStep = computed(() => currentStepIndex.value === totalSteps.value - 1)

  const progress = computed(() =>
    totalSteps.value > 0
      ? ((currentStepIndex.value + 1) / totalSteps.value) * 100
      : 0
  )

  // --- Actions ---
  function startScribeTour() {
    currentBranch.value = 'common'
    currentStepIndex.value = 0
    isActive.value = true
  }

  function nextStep() {
    if (currentStepIndex.value < totalSteps.value - 1) {
      currentStepIndex.value++
    } else {
      // If we're on the last step of common branch and a mode is selected, transition
      if (currentBranch.value === 'common') {
        // Stay on common until user selects a mode
        completeTour()
      } else if (currentBranch.value !== 'step2') {
        // Transition to step2 branch
        enterStep2()
      } else {
        completeTour()
      }
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

  // Branch management
  function setBranch(branch) {
    if (['auto', 'manual', 'json'].includes(branch)) {
      // When switching to a method branch, we need to find where to continue
      const previousBranch = currentBranch.value
      currentBranch.value = branch

      // If we were on a common step, find the equivalent position in new branch
      if (previousBranch === 'common') {
        // Stay at current index if still valid
        if (currentStepIndex.value >= currentSteps.value.length) {
          currentStepIndex.value = currentSteps.value.length - 1
        }
      } else if (previousBranch !== branch) {
        // Switching between method branches - go to first method-specific step
        const firstMethodStepIndex = currentSteps.value.findIndex(s =>
          s.branch === branch
        )
        if (firstMethodStepIndex !== -1) {
          currentStepIndex.value = firstMethodStepIndex
        }
      }
    }
  }

  function enterStep2() {
    currentBranch.value = 'step2'
    currentStepIndex.value = 0
  }

  function skipTour() {
    isActive.value = false
    hasSeenScribeTour.value = true
    persistTourState({ skipped: true })
  }

  function completeTour() {
    isActive.value = false
    hasSeenScribeTour.value = true
    persistTourState({ completed: true })
  }

  function resetTour() {
    currentBranch.value = 'common'
    currentStepIndex.value = 0
    hasSeenScribeTour.value = false
    isActive.value = false
    clearTourStorage()
  }

  // Set the modal container reference (called from ScribeDetectionPopup)
  function setModalContainer(el) {
    modalContainer.value = el
  }

  // --- Persistence ---
  function persistTourState(options = {}) {
    try {
      const state = {
        hasSeenTour: hasSeenScribeTour.value,
        completed: options.completed || false,
        skipped: options.skipped || false,
        lastBranch: currentBranch.value,
        lastStep: currentStepIndex.value,
        timestamp: Date.now()
      }
      localStorage.setItem(SCRIBE_TOUR_STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Could not persist scribe tour state:', e)
    }
  }

  function loadTourState() {
    try {
      const saved = localStorage.getItem(SCRIBE_TOUR_STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved)
        hasSeenScribeTour.value = state.hasSeenTour || state.completed || state.skipped || false
      }
    } catch (e) {
      console.warn('Could not load scribe tour state:', e)
    }
  }

  function clearTourStorage() {
    try {
      localStorage.removeItem(SCRIBE_TOUR_STORAGE_KEY)
    } catch (e) {
      console.warn('Could not clear scribe tour storage:', e)
    }
  }

  // Load state on initialization
  loadTourState()

  // Watch for step changes to persist progress (only while tour is active)
  watch([currentStepIndex, currentBranch], () => {
    if (isActive.value) {
      persistTourState()
    }
  })

  return {
    // State (readonly to prevent external mutation)
    isActive: readonly(isActive),
    currentStep,
    currentStepIndex: readonly(currentStepIndex),
    currentBranch: readonly(currentBranch),
    totalSteps,
    isFirstStep,
    isLastStep,
    progress,
    hasSeenScribeTour: readonly(hasSeenScribeTour),
    modalContainer: readonly(modalContainer),

    // Actions
    startScribeTour,
    nextStep,
    prevStep,
    goToStep,
    setBranch,
    enterStep2,
    skipTour,
    completeTour,
    resetTour,
    setModalContainer,
    loadTourState
  }
}
