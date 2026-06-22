'use client'

// Central PWA-install controller. The browser fires `beforeinstallprompt` ONCE,
// so we capture it in one place and let any number of UI surfaces (the auto
// banner, an explicit "Install app" button, settings) share the deferred prompt.

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
let initialized = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function isStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Registers the global listeners once. Safe to call from many components. */
export function initPwaInstall(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  if (isStandaloneNow()) installed = true

  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the mini-infobar so we can trigger the prompt on our own button.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })

  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
}

export function subscribePwaInstall(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/** True once the native prompt has been captured and can be triggered. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null
}

export function isInstalled(): boolean {
  return installed || isStandaloneNow()
}

/** iOS Safari never fires beforeinstallprompt, so it needs manual instructions. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIPhone = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ masquerades as macOS; detect via touch support.
  const isIPadOS = /Macintosh/.test(ua) && 'ontouchend' in document
  return isIPhone || isIPadOS
}

/** Triggers the native install prompt. Returns the user's choice (or 'unavailable'). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  try {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') installed = true
    deferredPrompt = null
    emit()
    return choice.outcome
  } catch {
    deferredPrompt = null
    emit()
    return 'dismissed'
  }
}

// Register as early as the module is imported (the layout's registrar pulls it in
// near the top of the client bundle), so we don't miss an early event.
if (typeof window !== 'undefined') initPwaInstall()
