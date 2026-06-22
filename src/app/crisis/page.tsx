import type { Metadata } from 'next'
import { CRISIS_RESOURCES } from '@/lib/crisis-resources'
import { Card } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Crisis support & helplines - KinSpace',
  description:
    'If you are in crisis or thinking about suicide or self-harm, you are not alone. Free, confidential South African and international helplines, available now.',
}

export default function CrisisPage() {
  const za = CRISIS_RESOURCES.filter((r) => r.region === 'ZA')
  const intl = CRISIS_RESOURCES.filter((r) => r.region === 'INTL')

  return (
    <main className="page-shell">
      <div className="page-container max-w-3xl">
        <header className="py-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent2">You are not alone</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-background">If you need help right now</h1>
          <p className="mx-auto mt-3 max-w-xl text-brand-background/70">
            If you are in immediate danger, call emergency services. These lines are free, confidential, and answered
            by people who want to help. Reaching out is a sign of strength.
          </p>
        </header>

        <section aria-labelledby="za-heading" className="mt-4">
          <h2 id="za-heading" className="mb-3 text-lg font-bold text-brand-background">
            South Africa
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {za.map((r) => (
              <Card key={r.name} className="flex flex-col gap-1">
                <h3 className="font-semibold text-brand-background">{r.name}</h3>
                <p className="text-sm text-brand-background/65">{r.description}</p>
                {r.phone && (
                  <a
                    href={`tel:${r.phone.replace(/\s+/g, '')}`}
                    className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-brand-accent1 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent1/90"
                  >
                    Call {r.phone}
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="intl-heading" className="mt-8">
          <h2 id="intl-heading" className="mb-3 text-lg font-bold text-brand-background">
            Anywhere in the world
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {intl.map((r) => (
              <Card key={r.name} className="flex flex-col gap-1">
                <h3 className="font-semibold text-brand-background">{r.name}</h3>
                <p className="text-sm text-brand-background/65">{r.description}</p>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-brand-background/30 px-4 py-2 text-sm font-semibold text-brand-background hover:bg-brand-background/10"
                  >
                    Find a helpline
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>

        <p className="mt-8 rounded-xl border border-brand-background/10 bg-brand-background/5 p-4 text-center text-sm text-brand-background/60">
          KinSpace is a peer-support community and is not an emergency service. If a life is in danger, please call your
          local emergency number immediately.
        </p>
      </div>
    </main>
  )
}
