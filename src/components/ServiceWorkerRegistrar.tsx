'use client'

import { useEffect, useState } from 'react'
import {
  initPwaInstall,
  subscribePwaInstall,
  canPromptInstall,
  isInstalled,
  promptInstall,
} from '@/lib/pwa-install'

const DISMISS_KEY = 'kinspace:install-dismissed-at'
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export default function ServiceWorkerRegistrar() {
  const [, setTick] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register the service worker after load so it doesn't compete with LCP.
    if ('serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => undefined)
      }
      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register, { once: true })
      }
    }

    // Install prompt is owned by the shared controller (so the explicit
    // "Install app" button and this auto-banner share the one-shot event).
    initPwaInstall()

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? '0')
    const recentlyDismissed = Boolean(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS

    const sync = () => {
      setTick((n) => n + 1)
      if (canPromptInstall() && !isInstalled() && !recentlyDismissed) {
        // Gentle delay so the banner doesn't interrupt the first impression.
        setTimeout(() => setVisible(true), 4000)
      }
      if (isInstalled()) setVisible(false)
    }
    sync()
    return subscribePwaInstall(sync)
  }, [])

  async function acceptInstall() {
    await promptInstall()
    setVisible(false)
  }

  function dismiss() {
    setVisible(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
  }

  if (!visible || isInstalled() || !canPromptInstall()) return null

  return (
    <div
      className="fixed bottom-24 left-1/2 z-[80] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-[#eedfc8]/15 bg-[#244039] p-4 shadow-[0_18px_48px_rgba(16,28,24,0.45)] md:bottom-6"
      role="dialog"
      aria-label="Install KinSpace"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#D19A58]/15 text-[#D19A58]">
          <i className="ri-smartphone-line text-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#eedfc8]">Install KinSpace</p>
          <p className="mt-1 text-xs leading-relaxed text-[#eedfc8]/65">
            Add it to your home screen for faster access and offline support.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={acceptInstall}
              className="btn-primary !rounded-full !py-1.5 !px-3 text-xs"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-full bg-[#eedfc8]/8 px-3 py-1.5 text-xs text-[#eedfc8]/65 hover:bg-[#eedfc8]/14"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="text-[#eedfc8]/40 hover:text-[#eedfc8]/70"
        >
          <i className="ri-close-line" />
        </button>
      </div>
    </div>
  )
}
