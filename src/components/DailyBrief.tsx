'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { Card } from '@/components/ui'

type BriefCard = {
  id: string
  tone: 'support' | 'gentle' | 'positive'
  icon: string
  title: string
  body: string
  cta_label: string
  cta_href: string
}

const TONE: Record<string, { wrap: string; chip: string }> = {
  support: { wrap: 'border-brand-accent2/30 bg-brand-accent2/[0.06]', chip: 'bg-brand-accent2/15 text-brand-accent2' },
  gentle: { wrap: 'border-brand-accent3/30 bg-brand-accent3/[0.06]', chip: 'bg-brand-accent3/15 text-brand-accent3' },
  positive: { wrap: 'border-brand-accent5/30 bg-brand-accent5/[0.06]', chip: 'bg-brand-accent5/15 text-brand-accent5' },
}

/**
 * The proactive companion brief: cards composed server-side from the member's own
 * data, threaded across pillars (mood + adherence). Renders nothing when empty so
 * it never adds noise. This is the connective tissue of the everything-app vision.
 */
export default function DailyBrief() {
  const { user } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<BriefCard[]>([])

  useEffect(() => {
    if (!user) return
    let active = true
    DatabaseService.getDailyBrief(user.userId)
      .then((rows: BriefCard[]) => {
        if (active) setCards(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (active) setCards([])
      })
    return () => {
      active = false
    }
  }, [user])

  if (cards.length === 0) return null

  return (
    <section className="space-y-3" aria-label="Your brief">
      <div className="flex items-center gap-2">
        <i className="ri-sparkling-2-line text-brand-accent2" aria-hidden="true" />
        <h2 className="text-lg font-bold text-brand-background">Your brief</h2>
      </div>
      <div className="space-y-3">
        {cards.map((card) => {
          const tone = TONE[card.tone] ?? TONE.support
          return (
            <Card key={card.id} className={tone.wrap}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
                  <i className={`${card.icon} text-lg`} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-background">{card.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-background/65">{card.body}</p>
                  <button
                    type="button"
                    onClick={() => router.push(card.cta_href)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-accent2 hover:underline"
                  >
                    {card.cta_label}
                    <i className="ri-arrow-right-line" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
