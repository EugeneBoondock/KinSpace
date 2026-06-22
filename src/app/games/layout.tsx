import type { ReactNode } from 'react'

/**
 * The game screens are designed as immersive dark surfaces (hardcoded warm-on-dark
 * palette). Scope the whole /games route to the dark theme so they render as
 * intended regardless of the app-wide light default.
 */
export default function GamesLayout({ children }: { children: ReactNode }) {
  return <div className="dark min-h-screen bg-brand-dark">{children}</div>
}
