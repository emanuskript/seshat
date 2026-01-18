import { watch, onUnmounted } from 'vue'

/**
 * Composable for trapping focus within a container element.
 * Useful for modals and dialogs to ensure keyboard navigation stays within the component.
 *
 * @param {Ref<HTMLElement>} containerRef - Ref to the container element
 * @param {Ref<boolean>} isActive - Ref indicating whether focus trap is active
 */
export function useFocusTrap(containerRef, isActive) {
  let previousActiveElement = null

  const FOCUSABLE_SELECTORS = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const getFocusableElements = () => {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll(FOCUSABLE_SELECTORS))
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab: go backwards
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: go forwards
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  const activate = () => {
    previousActiveElement = document.activeElement

    // Focus first focusable element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        focusableElements[0].focus()
      })
    }

    document.addEventListener('keydown', handleKeyDown)
  }

  const deactivate = () => {
    document.removeEventListener('keydown', handleKeyDown)

    // Return focus to previously focused element
    if (previousActiveElement && previousActiveElement.focus) {
      previousActiveElement.focus()
    }
    previousActiveElement = null
  }

  watch(isActive, (active) => {
    if (active) {
      activate()
    } else {
      deactivate()
    }
  }, { immediate: true })

  onUnmounted(() => {
    deactivate()
  })

  return {
    activate,
    deactivate,
  }
}
