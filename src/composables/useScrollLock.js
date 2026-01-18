import { watch, onUnmounted } from 'vue'

/**
 * Composable for preventing body scroll when a modal/dialog is open.
 * Preserves scroll position and prevents background scrolling.
 *
 * @param {Ref<boolean>} isLocked - Ref indicating whether scroll should be locked
 */
export function useScrollLock(isLocked) {
  let scrollPosition = 0
  let originalOverflow = ''
  let originalPaddingRight = ''

  const getScrollbarWidth = () => {
    // Create a temporary element to measure scrollbar width
    const outer = document.createElement('div')
    outer.style.visibility = 'hidden'
    outer.style.overflow = 'scroll'
    document.body.appendChild(outer)

    const inner = document.createElement('div')
    outer.appendChild(inner)

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth
    outer.parentNode.removeChild(outer)

    return scrollbarWidth
  }

  const lock = () => {
    // Store current scroll position
    scrollPosition = window.scrollY

    // Store original styles
    originalOverflow = document.body.style.overflow
    originalPaddingRight = document.body.style.paddingRight

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = getScrollbarWidth()

    // Apply lock styles
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    // For iOS Safari: prevent touchmove
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollPosition}px`
    document.body.style.width = '100%'
  }

  const unlock = () => {
    // Restore original styles
    document.body.style.overflow = originalOverflow
    document.body.style.paddingRight = originalPaddingRight

    // For iOS Safari: restore position
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''

    // Restore scroll position
    window.scrollTo(0, scrollPosition)
  }

  watch(isLocked, (locked) => {
    if (locked) {
      lock()
    } else {
      unlock()
    }
  }, { immediate: true })

  onUnmounted(() => {
    // Ensure we unlock when component is destroyed
    if (isLocked.value) {
      unlock()
    }
  })

  return {
    lock,
    unlock,
  }
}
