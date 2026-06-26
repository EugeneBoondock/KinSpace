'use client'

import { setTrackingConsent, type TrackingConsent } from '@/lib/tracking-consent'
import { useClientReady, useTrackingConsent } from '@/lib/use-tracking-consent'
import { useAuth } from '@/lib/AuthContext'

export default function TrackingConsentBanner() {
  const clientReady = useClientReady()
  const consent = useTrackingConsent()
  const { user } = useAuth()

  const chooseConsent = (value: TrackingConsent) => {
    setTrackingConsent(value)
  }

  if (!clientReady || consent !== null) return null

  return (
    <section
      aria-label="Ad measurement choice"
      className={`fixed inset-x-3 ${
        user ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
      } z-50 mx-auto max-w-3xl rounded-2xl border border-brand-line bg-brand-surface-raised p-4 text-brand-ink shadow-[var(--shadow-lift)] sm:bottom-4`}
      role="region"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-accent3/15">
            <i className="ri-advertisement-line text-brand-accent3" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-ink">Ad measurement</h2>
            <p className="mt-1 text-sm leading-relaxed text-brand-ink/70">
              KinSpace can use Meta Pixel PageView measurement to understand visits from ads. PageView can include this
              page URL. Health profile fields, disability details, messages, and notes are not sent.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-44">
          <button
            type="button"
            onClick={() => chooseConsent('denied')}
            className="rounded-full border border-brand-line-strong bg-brand-surface px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2"
          >
            Keep essential only
          </button>
          <button
            type="button"
            onClick={() => chooseConsent('granted')}
            className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-brand-surface transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2"
          >
            Allow PageView
          </button>
        </div>
      </div>
    </section>
  )
}
