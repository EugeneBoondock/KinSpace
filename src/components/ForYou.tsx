'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DatabaseService } from '@/lib/database'
import { Card } from '@/components/ui'
import { isTransientFetchError } from '@/lib/client-errors'
import { formatCompactNumber } from '@/lib/platform'

type ForYouGroup = {
  id: string
  name: string
  description: string
  category: string
  type: string
  members_count: number | null
  tags: string[]
}

type ForYouResource = {
  id: string
  title: string
  excerpt: string
  category: string
  type: string
  url: string | null
  tags: string[]
}

type ForYouData = {
  keywords: string[]
  groups: ForYouGroup[]
  resources: ForYouResource[]
}

export default function ForYou() {
  const [data, setData] = useState<ForYouData | null>(null)

  useEffect(() => {
    let cancelled = false
    DatabaseService.getForYou(4)
      .then((result) => {
        if (!cancelled) setData(result as ForYouData)
      })
      .catch((error) => {
        if (!cancelled && !isTransientFetchError(error)) console.error('Failed to load For You:', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Purely additive: render nothing until there's something genuinely relevant.
  if (!data || (data.groups.length === 0 && data.resources.length === 0)) return null

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-background">For you</h2>
        <p className="mt-1 text-sm text-brand-background/55">
          People and reading that match what you&apos;re living with. You&apos;re not the only one here.
        </p>
      </div>

      {data.groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">Groups that get it</p>
          {data.groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-start gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-3.5 transition-colors hover:bg-brand-background/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent3/[0.18] text-brand-accent3">
                <i className="ri-group-line text-lg" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-brand-background">{group.name}</span>
                <span className="mt-0.5 block truncate text-xs text-brand-background/50">
                  {formatCompactNumber(group.members_count ?? 0)} {group.members_count === 1 ? 'member' : 'members'} ·{' '}
                  <span className="capitalize">{group.category}</span>
                </span>
              </span>
              <i className="ri-arrow-right-s-line mt-1 shrink-0 text-brand-background/35" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      {data.resources.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">Reading for you</p>
          {data.resources.map((resource) => (
            <Link
              key={resource.id}
              href={`/research/${resource.id}`}
              className="flex items-start gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-3.5 transition-colors hover:bg-brand-background/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent2/[0.16] text-brand-accent2">
                <i className="ri-article-line text-lg" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-brand-background">{resource.title}</span>
                {resource.excerpt && (
                  <span className="mt-0.5 line-clamp-1 block text-xs text-brand-background/50">{resource.excerpt}</span>
                )}
              </span>
              <i className="ri-arrow-right-s-line mt-1 shrink-0 text-brand-background/35" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
