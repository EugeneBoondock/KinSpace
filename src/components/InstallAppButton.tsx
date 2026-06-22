'use client'

import { useEffect, useState } from 'react'
import {
  initPwaInstall,
  subscribePwaInstall,
  canPromptInstall,
  isInstalled,
  isIOS,
  isStandaloneNow,
  promptInstall,
} from '@/lib/pwa-install'

type InstallAppButtonProps = {
  className?: string
  label?: string
  /** Hide the leading download icon. */
  hideIcon?: boolean
}

const DEFAULT_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-full bg-brand-accent1 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-10px_rgba(207,111,68,0.55)] transition-opacity hover:opacity-90'

/**
 * On-demand "Install app" button so users don't have to wait for the browser's
 * engagement heuristics. Renders nothing when the app is already installed or
 * when install isn't possible (e.g. desktop Firefox). On iOS it opens manual
 * "Add to Home Screen" instructions, since iOS has no programmatic install.
 */
export default function InstallAppButton({ className, label = 'Install app', hideIcon }: InstallAppButtonProps) {
  const [, setTick] = useState(0)
  const [iosOpen, setIosOpen] = useState(false)

  useEffect(() => {
    initPwaInstall()
    const unsubscribe = subscribePwaInstall(() => setTick((n) => n + 1))
    // Re-read state once mounted, in case the event fired before this mounted.
    setTick((n) => n + 1)
    return unsubscribe
  }, [])

  if (isStandaloneNow() || isInstalled()) return null

  const ios = isIOS()
  // Nothing actionable on browsers that can neither prompt nor do iOS A2HS.
  if (!canPromptInstall() && !ios) return null

  async function handleClick() {
    if (ios) {
      setIosOpen(true)
      return
    }
    await promptInstall()
    setTick((n) => n + 1)
  }

  return (
    <>
      <button type="button" onClick={handleClick} className={className ?? DEFAULT_CLASS} aria-label={label}>
        {!hideIcon && <i className="ri-download-2-line" aria-hidden="true" />}
        <span>{label}</span>
      </button>

      {iosOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Add KinSpace to your Home Screen"
          onClick={() => setIosOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-brand-background/15 bg-brand-dark p-5 text-brand-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent1/15 text-brand-accent1">
                  <i className="ri-smartphone-line text-xl" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold">Add to your Home Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setIosOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-background/50 transition-colors hover:bg-brand-background/10 hover:text-brand-background"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-brand-background/80">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-background/10 text-xs font-bold">1</span>
                <span>
                  Tap the <strong className="text-brand-background">Share</strong> button{' '}
                  <i className="ri-share-box-line align-middle" aria-hidden="true" /> in Safari&rsquo;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-background/10 text-xs font-bold">2</span>
                <span>
                  Choose <strong className="text-brand-background">Add to Home Screen</strong>{' '}
                  <i className="ri-add-box-line align-middle" aria-hidden="true" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-background/10 text-xs font-bold">3</span>
                <span>
                  Tap <strong className="text-brand-background">Add</strong> &mdash; KinSpace opens like a native app.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setIosOpen(false)}
              className="mt-5 w-full rounded-full bg-brand-accent1 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
