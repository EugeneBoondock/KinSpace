'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, formatCompactNumber } from '@/lib/platform'

type ConditionDoc = Record<string, unknown> & { id: string }
type TopTreatment = Record<string, unknown> & {
  id: string
  treatment?: Record<string, unknown> & { id: string } | null
}
type Experience = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}

function effectivenessBar(value: number) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eedfc8]/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#6B8A83] to-[#D19A58]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function ConditionDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug as string | undefined
  const { user } = useAuth()

  const [condition, setCondition] = useState<ConditionDoc | null>(null)
  const [topTreatments, setTopTreatments] = useState<TopTreatment[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    async function load() {
      try {
        const conditionDoc = (await DatabaseService.getCondition(slug as string)) as ConditionDoc | null
        setCondition(conditionDoc)
        const resolvedSlug = conditionDoc?.id ?? (slug as string)
        const [treatments, experiencesList] = await Promise.all([
          DatabaseService.getTopTreatments(resolvedSlug, 10),
          DatabaseService.getExperiencesForCondition(resolvedSlug, { limit: 12 }),
        ])
        setTopTreatments(treatments as TopTreatment[])
        setExperiences(experiencesList as Experience[])
      } catch (error) {
        console.error('Failed to load condition:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const memberCount = (condition?.member_count as number | undefined) ?? 0

  const topTreatmentList = useMemo(() => topTreatments.filter((entry) => entry.treatment), [topTreatments])

  async function handleVote(experienceId: string, kind: 'helpful' | 'not_helpful') {
    if (!user) return
    await DatabaseService.voteOnExperience(user.userId, experienceId, kind)
    // Re-fetch to reflect vote
    const resolvedSlug = condition?.id ?? slug
    if (resolvedSlug) {
      const updated = await DatabaseService.getExperiencesForCondition(resolvedSlug, { limit: 12 })
      setExperiences(updated as Experience[])
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="space-y-4">
          <div className="h-32 skeleton rounded-3xl" />
          <div className="h-72 skeleton rounded-3xl" />
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!condition) {
    return (
      <PageFrame>
        <div className="card-light text-center">
          <i className="ri-pulse-line text-4xl text-[#eedfc8]/25" />
          <p className="mt-3 text-sm text-[#eedfc8]/60">Condition not found.</p>
          <Link href="/conditions" className="btn-primary mt-4 inline-block !py-2.5 !px-4 text-sm">
            Browse conditions
          </Link>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/conditions" className="text-sm text-[#D19A58]">
            ← All conditions
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83] capitalize">
              {(condition.category as string) ?? 'condition'}
            </span>
            <span className="badge">
              {formatCompactNumber(memberCount)} members tracking
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[#eedfc8]">{condition.name as string}</h1>
          {(condition.summary as string | undefined) && (
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#eedfc8]/70">
              {condition.summary as string}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/share-experience?condition=${condition.id}`}
              className="btn-primary !py-2.5 !px-4 text-sm"
            >
              Share your experience
            </Link>
            <Link href="/insights" className="btn-secondary !py-2.5 !px-4 text-sm">
              What works elsewhere
            </Link>
          </div>
        </section>

        <section className="page-grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="space-y-4">
            <section className="card">
              <h2 className="section-title">Most effective treatments</h2>
              {topTreatmentList.length === 0 ? (
                <p className="text-sm text-[#eedfc8]/55">
                  No treatments ranked yet. Be the first to share what worked for you.
                </p>
              ) : (
                <ol className="space-y-4">
                  {topTreatmentList.map((row, index) => {
                    const treatment = row.treatment!
                    const effectiveness = (row.effectiveness_avg as number | undefined) ?? 0
                    const count = (row.effectiveness_count as number | undefined) ?? 0
                    return (
                      <li key={row.id} className="rounded-2xl bg-[#eedfc8]/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#D19A58]">#{index + 1}</span>
                              <Link
                                href={`/treatments/${treatment.id}`}
                                className="text-lg font-semibold text-[#eedfc8] hover:text-[#D19A58]"
                              >
                                {treatment.name as string}
                              </Link>
                              <span className="badge bg-[#6B8A83]/15 text-[#6B8A83] text-[10px] capitalize">
                                {(treatment.kind as string) ?? 'treatment'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#eedfc8]/60">
                              {(treatment.summary as string | undefined) ?? 'Community-reported treatment.'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#D19A58]">
                              {effectiveness.toFixed(1)}
                            </p>
                            <p className="text-xs text-[#eedfc8]/45">
                              {count} {count === 1 ? 'rating' : 'ratings'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">{effectivenessBar(effectiveness)}</div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className="card">
              <h2 className="section-title">Member experiences</h2>
              {experiences.length === 0 ? (
                <p className="text-sm text-[#eedfc8]/55">
                  No stories yet — this is a great place to be the first voice.
                </p>
              ) : (
                <div className="space-y-4">
                  {experiences.map((experience) => {
                    const author = experience.profile
                    const name = experience.is_anonymous
                      ? 'Anonymous member'
                      : ((author?.full_name as string | undefined) ||
                          (author?.username as string | undefined) ||
                          'Community member')
                    const treatmentSlug = experience.treatment_slug as string | undefined
                    return (
                      <article key={experience.id} className="rounded-2xl bg-[#eedfc8]/5 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#eedfc8]/50">
                          <span className="font-semibold text-[#eedfc8]/75">{name}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(experience.created_at)}</span>
                          {treatmentSlug && (
                            <>
                              <span>·</span>
                              <Link href={`/treatments/${treatmentSlug}`} className="text-[#D19A58]">
                                {treatmentSlug.replace(/-/g, ' ')}
                              </Link>
                            </>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                          <span>
                            <span className="text-[#eedfc8]/50">Effectiveness:</span>{' '}
                            <span className="font-semibold text-[#D19A58]">
                              {(experience.effectiveness as number | undefined) ?? 0}/5
                            </span>
                          </span>
                          <span>
                            <span className="text-[#eedfc8]/50">Side effects:</span>{' '}
                            <span className="font-semibold text-[#B85C3A]">
                              {(experience.side_effects as number | undefined) ?? 0}/5
                            </span>
                          </span>
                          {(experience.duration_weeks as number | undefined) && (
                            <span className="text-[#eedfc8]/50">
                              Tried for {experience.duration_weeks as number} weeks
                            </span>
                          )}
                        </div>

                        {(experience.story_markdown as string | undefined) && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#eedfc8]/75">
                            {experience.story_markdown as string}
                          </p>
                        )}

                        <div className="mt-3 flex items-center gap-3 text-xs text-[#eedfc8]/50">
                          <button
                            onClick={() => handleVote(experience.id, 'helpful')}
                            className="flex items-center gap-1 hover:text-[#D19A58]"
                          >
                            <i className="ri-thumb-up-line" /> Helpful (
                            {(experience.helpful_count as number | undefined) ?? 0})
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="card">
              <h2 className="section-title">At a glance</h2>
              <div className="space-y-3">
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Treatments ranked</p>
                  <p className="mt-1 text-xl font-semibold text-[#eedfc8]">{topTreatmentList.length}</p>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Experiences shared</p>
                  <p className="mt-1 text-xl font-semibold text-[#eedfc8]">{experiences.length}</p>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Members tracking</p>
                  <p className="mt-1 text-xl font-semibold text-[#eedfc8]">
                    {formatCompactNumber(memberCount)}
                  </p>
                </div>
              </div>
            </section>

            {Array.isArray(condition.aliases) && (condition.aliases as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Also known as</h2>
                <div className="flex flex-wrap gap-2">
                  {(condition.aliases as string[]).map((alias) => (
                    <span key={alias} className="badge">
                      {alias}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="card">
              <h2 className="section-title">Important</h2>
              <p className="text-xs leading-relaxed text-[#eedfc8]/55">
                Ratings are member-reported experiences, not clinical evidence. Always talk with your
                care team before changing treatments. KinSpace does not provide medical advice.
              </p>
            </section>
          </aside>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
