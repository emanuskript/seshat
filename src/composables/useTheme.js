import { ref, onMounted } from 'vue'

const THEME_KEY = 'quillapp-theme'
const THEMES = ['light', 'dark', 'high-contrast']

// Global reactive state (shared across components)
const currentTheme = ref('light')

export function useTheme() {
  const setTheme = (theme) => {
    if (!THEMES.includes(theme)) return

    currentTheme.value = theme

    // Remove all theme classes
    document.documentElement.classList.remove('dark', 'high-contrast')

    // Apply new theme class (light is default, no class needed)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'high-contrast') {
      document.documentElement.classList.add('high-contrast')
    }

    // Persist to localStorage
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch (e) {
      console.warn('Could not save theme preference:', e)
    }
  }

  const toggleTheme = () => {
    const currentIndex = THEMES.indexOf(currentTheme.value)
    const nextIndex = (currentIndex + 1) % THEMES.length
    setTheme(THEMES[nextIndex])
  }

  const initTheme = () => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved && THEMES.includes(saved)) {
        setTheme(saved)
      } else {
        // Check system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark')
        } else if (window.matchMedia('(prefers-contrast: more)').matches) {
          setTheme('high-contrast')
        }
      }
    } catch (e) {
      console.warn('Could not load theme preference:', e)
    }
  }

  onMounted(() => {
    initTheme()
  })

  return {
    currentTheme,
    setTheme,
    toggleTheme,
    themes: THEMES,
  }
}
