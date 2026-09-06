import { ref, onMounted } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'dstu-theme'
const theme = ref<Theme>('dark')

export function useTheme() {
  function apply(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
  }

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
  }

  function toggle() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'light' || saved === 'dark') {
      theme.value = saved
    }
    apply(theme.value)
  })

  return { theme, setTheme, toggle }
}
