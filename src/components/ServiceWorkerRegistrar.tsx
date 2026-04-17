'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'kinspace:install-dismissed-at'
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export default function ServiceWorkerRegistrar() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [alreadyInstalled, setAlreadyInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register service worker after page load so it doesn't compete with LCP
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

    // Detect already-installed PWA
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (isStandalone) {
      setAlreadyInstalled(true)
      return
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? '0')
    const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS

    function handleBeforeInstall(event: Event) {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
      if (!recentlyDismissed) {
        setTimeout(() => setVisible(true), 4000)
      }
    }

    function handleInstalled() {
      setVisible(false)
      setPrompt(null)
      setAlreadyInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function acceptInstall() {
    if (!prompt) return
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      // user cancelled — that's fine
    } finally {
      setVisible(false)
      setPrompt(null)
    }
  }

  function dismiss() {
    setVisible(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
  }

  if (!visible || !prompt || alreadyInstalled) return null

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
