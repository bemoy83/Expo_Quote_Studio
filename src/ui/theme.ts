// Theme switch: light, dark or follow the system. The colours are in styles/tokens/dark.css, keyed on html[data-theme].
import { useEffect, useState } from 'react'
import { loadTheme, saveTheme, type Theme } from '../persistence/storage'

const SYSTEM_DARK = '(prefers-color-scheme: dark)'

/** What html[data-theme] should be: the choice, or the system's when following it. */
export function resolveTheme(t: Theme, systemDark: boolean): 'light' | 'dark' {
  return t === 'system' ? (systemDark ? 'dark' : 'light') : t
}

/** The next choice for the switch: system → light → dark → system. */
export const nextTheme = (t: Theme): Theme => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  useEffect(() => {
    const mq = window.matchMedia(SYSTEM_DARK)
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, mq.matches)
    }
    apply()
    if (theme !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  const choose = (t: Theme) => {
    setTheme(t)
    saveTheme(t)
  }
  return [theme, choose]
}
