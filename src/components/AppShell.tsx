import type { ReactNode } from 'react'
import { classNames } from '@/lib/platform'
import ResponsiveNavbar from '@/components/ResponsiveNavbar'
import Footer from '@/components/Footer'

interface AppShellProps {
  children: ReactNode
  className?: string
  containerClassName?: string
  /** Show the top navigation bar (default true). Hide on immersive pages like therapy. */
  showNav?: boolean
  /** Show the public footer (default false - set true on marketing/static pages). */
  showFooter?: boolean
  /** Pad bottom for the floating BottomNav (default true for authed pages). */
  padBottom?: boolean
}

/**
 * Unified application shell. One consistent frame for every page:
 *   <ResponsiveNavbar>  (top, theme-aware)
 *   <page-shell>        (warm gradient canvas)
 *     <page-container>  (centered, responsive max width)
 *       children
 *   <Footer>            (optional, public pages)
 *
 * Replaces the raw <main className="page-shell"> pattern used by profile,
 * settings, crisis, guidelines, and pricing - so every route shares framing.
 *
 * Authenticated pages still render their own <BottomNav /> at the bottom of
 * their content; the shell's padBottom reserves space for it.
 */
export default function AppShell({
  children,
  className,
  containerClassName,
  showNav = true,
  showFooter = false,
  padBottom = true,
}: AppShellProps) {
  return (
    <>
      {showNav && <ResponsiveNavbar />}
      <div className={classNames('page-shell', !padBottom && '!pb-0', className)}>
        <div className={classNames('page-container', containerClassName)}>{children}</div>
      </div>
      {showFooter && <Footer />}
    </>
  )
}
