'use client'

import { setCookieConsent, type CookieConsent, shouldShowCookieConsent } from '@/lib/cookie-consent'
import { useClientReady, useCookieConsent } from '@/lib/use-cookie-consent'
import { useAuth } from '@/lib/AuthContext'

export default function CookieConsentBanner() {
  const clientReady = useClientReady()
  const consent = useCookieConsent()
  const { user } = useAuth()

  const chooseConsent = (value: CookieConsent) => {
    setCookieConsent(value)
  }

  if (!clientReady || !shouldShowCookieConsent(consent)) return null

  return (
    <section
      aria-label="Cookie choice"
      className={`fixed inset-x-3 ${
        user ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
      } z-50 mx-auto max-w-3xl rounded-2xl border border-brand-line bg-brand-surface-raised p-4 text-brand-ink shadow-[var(--shadow-lift)] sm:bottom-4`}
      role="region"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-accent3/15">
            <i className="ri-cookie-line text-brand-accent3" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-ink">Cookie preferences</h2>
            <p className="mt-1 text-sm leading-relaxed text-brand-ink/70">
              KinSpace uses essential cookies to keep you signed in and local storage to remember choices like theme,
              sound, and privacy settings. No third-party ad tracker is used.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-44">
          <button
            type="button"
            onClick={() => chooseConsent('essential')}
            className="rounded-full border border-brand-line-strong bg-brand-surface px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2"
          >
            Only essentials
          </button>
          <button
            type="button"
            onClick={() => chooseConsent('accepted')}
            className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-brand-surface transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </section>
  )
}
