'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Bottom-sheet on mobile / right-side dialog on desktop.
 * For mobile filters, composers, and quick actions where a centered Modal
 * feels too heavy. Esc + backdrop dismiss, scroll-locked, focus-friendly.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex h-full w-full max-w-md flex-col bg-brand-surface shadow-2xl',
          'animate-slide-in-right',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
            <h2 className="text-base font-bold text-brand-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-brand-ink/60 transition-colors hover:bg-brand-ink/10 hover:text-brand-ink"
            >
              <i className="ri-close-line text-lg" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
