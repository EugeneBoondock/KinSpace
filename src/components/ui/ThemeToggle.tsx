'use client'

import { useTheme } from '@/components/ThemeProvider'
import { cn } from '@/lib/cn'

/**
 * Light/dark toggle. Animated sun/moon swap.
 * Sits in the nav and settings.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full text-brand-ink/70',
        'transition-colors hover:bg-brand-ink/10 hover:text-brand-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
        className,
      )}
    >
      <i
        className={cn(
          'ri-moon-line text-lg transition-all duration-300',
          isDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        )}
        aria-hidden="true"
      />
      <i
        className={cn(
          'ri-sun-line absolute text-lg transition-all duration-300',
          isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0',
        )}
        aria-hidden="true"
      />
    </button>
  )
}
