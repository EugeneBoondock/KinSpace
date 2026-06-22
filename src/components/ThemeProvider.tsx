'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
export type MotionPref = 'full' | 'reduced'

interface ThemeContextValue {
  /** Resolved visual theme. */
  theme: Theme
  /** Toggle or set the theme; persisted to localStorage. */
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** Motion preference (user choice overrides system when set). */
  motion: MotionPref
  setMotion: (pref: MotionPref) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
  motion: 'full',
  setMotion: () => undefined,
})

const THEME_KEY = 'kinspace-theme'
const MOTION_KEY = 'kinspace-motion'

export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Inline script injected into <head> BEFORE first paint.
 * It reads the persisted theme + system preference and applies the `.dark`
 * class to <html> synchronously - preventing a flash of the wrong theme (FOUC).
 *
 * Kept as a string so Next can render it via dangerouslySetInnerHTML.
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    var motion = localStorage.getItem('${MOTION_KEY}');
    if (motion === 'reduced' || (!motion && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    }
  } catch (e) {}
})();
`.trim()

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getSystemMotion(): MotionPref {
  if (typeof window === 'undefined') return 'full'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return (localStorage.getItem(THEME_KEY) as Theme | null) ?? getSystemTheme()
}

function getInitialMotion(): MotionPref {
  if (typeof window === 'undefined') return 'full'
  return (localStorage.getItem(MOTION_KEY) as MotionPref | null) ?? getSystemMotion()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [motion, setMotionState] = useState<MotionPref>(getInitialMotion)

  // Keep the <html> class in sync with state.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (motion === 'reduced') root.setAttribute('data-reduced-motion', 'true')
    else root.removeAttribute('data-reduced-motion')
  }, [motion])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* storage may be unavailable (private mode) - non-fatal */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setMotion = useCallback((next: MotionPref) => {
    setMotionState(next)
    try {
      localStorage.setItem(MOTION_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, motion, setMotion }}>
      {children}
    </ThemeContext.Provider>
  )
}
