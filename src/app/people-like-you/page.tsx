'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { MemberAvatar, MemberName } from '@/components/MemberIdentity'
import StrandButton from '@/components/StrandButton'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { Badge, Button, Card, EmptyState, Field, Input, LinkButton, Select, Skeleton } from '@/components/ui'

type SharedTraits = {
  conditions?: string[]
  comorbidities?: string[]
  interests?: string[]
  symptoms?: string[]
  treatments?: string[]
}

type SimilarMember = {
  id: string
  user_id?: string
  username?: string | null
  full_name?: string | null
  pseudonym?: string | null
  is_anonymous?: boolean
  avatar_url?: string | null
  similarity_score?: number
  shared?: SharedTraits
  match_reasons?: string[]
  starter_prompt?: string
  activity_labels?: string[]
  message_prompt_allowed?: boolean
}

type PeopleFilters = {
  conditionSlug: string
  symptom: string
  treatment: string
  ageBand: string
  location: string
}

type MatchSignalLane = {
  kind: 'symptom' | 'treatment'
  label: string
  value: string
  match_count?: number
}

const HIGH_MATCH_SCORE = 14
const STRONG_MATCH_SCORE = 8

function matchTone(score: number): { label: string; tone: 'sage' | 'gold' | 'neutral' } {
  if (score >= HIGH_MATCH_SCORE) return { label: 'High match', tone: 'sage' }
  if (score >= STRONG_MATCH_SCORE) return { label: 'Strong match', tone: 'gold' }
  return { label: 'Match', tone: 'neutral' }
}

function displayName(member: SimilarMember): string {
  if (member.is_anonymous) return member.pseudonym || 'Anonymous member'
  return member.full_name || member.username || 'Community member'
}

function MatchCard({ member }: { member: SimilarMember }) {
  const name = displayName(member)
  const score = member.similarity_score ?? 0
  const match = matchTone(score)
  const starterPrompt = member.starter_prompt
  const activityLabels = member.activity_labels ?? []

  return (
    <Card interactive className="space-y-4">
      <div className="flex items-start gap-4">
        <MemberAvatar
          profile={member as unknown as Record<string, unknown>}
          alt={name}
          avatarUrl={member.avatar_url}
          fullName={member.is_anonymous ? null : member.full_name}
          username={member.is_anonymous ? null : member.username}
          userId={member.id}
          isAnonymous={Boolean(member.is_anonymous)}
          className="h-12 w-12 rounded-2xl object-cover"
          fallbackClassName="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent3/15"
          fallbackTextClassName="text-base font-semibold text-brand-accent3"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MemberName
              profile={member as unknown as Record<string, unknown>}
              userId={member.id}
              name={name}
              isAnonymous={Boolean(member.is_anonymous)}
              className="text-base font-semibold text-brand-ink hover:text-brand-accent3"
              quickActionClassName="border-brand-ink/10 bg-brand-ink/[0.04] text-brand-ink/60 hover:bg-brand-accent2/15"
            />
            <Badge tone={match.tone}>{match.label}</Badge>
            {activityLabels.map((label) => (
              <Badge key={label} tone={label === 'Available now' ? 'sage' : 'neutral'}>
                {label}
              </Badge>
            ))}
          </div>
          {member.username && !member.is_anonymous && (
            <p className="mt-0.5 truncate text-xs text-brand-ink/50">@{member.username}</p>
          )}
        </div>

        <div className="shrink-0">
          <StrandButton targetUserId={member.id} size="sm" />
        </div>
      </div>

      {/* PRIVACY: never name (or categorise) what a member shares — just signal the
          overlap. The specific "what" stays between the two people. */}
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="sage">Something in common</Badge>
      </div>

      {starterPrompt && (
        <p className="flex gap-2 text-sm leading-relaxed text-brand-ink/60">
          <i className="ri-chat-smile-2-line mt-0.5 text-brand-accent3" aria-hidden="true" />
          <span>{starterPrompt}</span>
        </p>
      )}

      {member.message_prompt_allowed === false && (
        <p className="text-xs leading-relaxed text-brand-ink/50">
          Start with a strand request before messaging.
        </p>
      )}
    </Card>
  )
}

function LoadingSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-6 w-3/4 rounded-full" />
        </Card>
      ))}
    </div>
  )
}

export default function PeopleLikeYouPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<SimilarMember[]>([])
  const [lanes, setLanes] = useState<MatchSignalLane[]>([])
  const [lanesLoading, setLanesLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PeopleFilters>(() => ({
    conditionSlug: searchParams.get('condition') ?? '',
    symptom: '',
    treatment: '',
    ageBand: '',
    location: '',
  }))
  const [appliedFilters, setAppliedFilters] = useState<PeopleFilters>(filters)

  useEffect(() => {
    if (!user) {
      setLanes([])
      setLanesLoading(false)
      return
    }
    let active = true
    const userId = user.userId
    async function loadLanes() {
      try {
        setLanesLoading(true)
        const result = (await DatabaseService.getMatchSignalLanes(userId, { limit: 6 })) as MatchSignalLane[]
        if (active) setLanes(Array.isArray(result) ? result : [])
      } catch (error) {
        console.error('Failed to load match lanes:', error)
        if (active) setLanes([])
      } finally {
        if (active) setLanesLoading(false)
      }
    }
    loadLanes()
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let active = true
    const userId = user.userId
    async function load() {
      try {
        setLoading(true)
        const query = Object.fromEntries(
          Object.entries(appliedFilters).filter(([, value]) => value.trim().length > 0),
        )
        const result = (await DatabaseService.getSimilarMembers(userId, { ...query, limit: 12 })) as SimilarMember[]
        if (active) setMembers(Array.isArray(result) ? result : [])
      } catch (error) {
        console.error('Failed to load similar members:', error)
        if (active) setMembers([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user, appliedFilters])

  function updateFilter(key: keyof PeopleFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  function clearFilters() {
    const blank = { conditionSlug: '', symptom: '', treatment: '', ageBand: '', location: '' }
    setFilters(blank)
    setAppliedFilters(blank)
  }

  function applyLane(lane: MatchSignalLane) {
    const next = {
      ...filters,
      symptom: lane.kind === 'symptom' ? lane.value || lane.label : '',
      treatment: lane.kind === 'treatment' ? lane.value || lane.label : '',
    }
    setFilters(next)
    setAppliedFilters(next)
  }

  return (
    <PageFrame containerClassName="max-w-4xl">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="eyebrow">Your people</p>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">People like you</h1>
          <p className="max-w-2xl text-base leading-relaxed text-brand-ink/65">
            Members weighted by shared conditions, symptoms, treatments, goals, and lived context.
            Reach out when a strand feels right.
          </p>
        </header>

        <Card className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Match lanes</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-ink/55">
                Start with the symptoms and treatments that have the strongest peer signal.
              </p>
            </div>
            <Badge tone="sage">Private by design</Badge>
          </div>

          {lanesLoading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : lanes.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lanes.map((lane) => {
                const isActive =
                  (lane.kind === 'symptom' && appliedFilters.symptom === (lane.value || lane.label)) ||
                  (lane.kind === 'treatment' && appliedFilters.treatment === (lane.value || lane.label))
                const count = lane.match_count ?? 0

                return (
                  <button
                    key={`${lane.kind}-${lane.value || lane.label}`}
                    type="button"
                    onClick={() => applyLane(lane)}
                    aria-pressed={isActive}
                    className={`rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent3/40 ${
                      isActive
                        ? 'border-brand-accent3/50 bg-brand-accent3/15'
                        : 'border-brand-line bg-brand-ink/[0.035] hover:border-brand-accent3/35 hover:bg-brand-accent3/[0.07]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold capitalize text-brand-ink">{lane.label}</p>
                        <p className="mt-0.5 text-xs capitalize text-brand-ink/50">{lane.kind}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-surface px-2 py-0.5 text-xs font-semibold text-brand-ink">
                        {count} {count === 1 ? 'peer' : 'peers'}
                      </span>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-accent3">
                      Use lane
                      <i className="ri-arrow-right-s-line" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-line bg-brand-ink/[0.035] p-4">
              <p className="text-sm font-semibold text-brand-ink">No lanes yet</p>
              <p className="mt-1 text-sm leading-relaxed text-brand-ink/55">
                Add a condition report with symptoms or treatments to get guided peer lanes.
              </p>
              <LinkButton href="/contribute" variant="secondary" size="sm" className="mt-3">
                Add report
              </LinkButton>
            </div>
          )}
        </Card>

        <Card>
          <form onSubmit={applyFilters} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Find a closer match</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-ink/55">
                Symptom and treatment filters only use reports members chose to show in search.
                Age and area help ranking but are never shown on match cards.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Condition" htmlFor="condition-filter">
                <Input
                  id="condition-filter"
                  value={filters.conditionSlug}
                  onChange={(event) => updateFilter('conditionSlug', event.target.value)}
                  placeholder="Anxiety"
                />
              </Field>
              <Field label="Symptom" htmlFor="symptom-filter">
                <Input
                  id="symptom-filter"
                  value={filters.symptom}
                  onChange={(event) => updateFilter('symptom', event.target.value)}
                  placeholder="Fatigue"
                />
              </Field>
              <Field label="Treatment" htmlFor="treatment-filter">
                <Input
                  id="treatment-filter"
                  value={filters.treatment}
                  onChange={(event) => updateFilter('treatment', event.target.value)}
                  placeholder="CBT"
                />
              </Field>
              <Field label="Age band" htmlFor="age-filter">
                <Select
                  id="age-filter"
                  value={filters.ageBand}
                  onChange={(event) => updateFilter('ageBand', event.target.value)}
                >
                  <option value="">Any age</option>
                  <option value="under-20">Under 20</option>
                  <option value="20s">20s</option>
                  <option value="30s">30s</option>
                  <option value="40s">40s</option>
                  <option value="50s">50s</option>
                  <option value="60-plus">60 plus</option>
                </Select>
              </Field>
              <Field label="Area" htmlFor="area-filter">
                <Input
                  id="area-filter"
                  value={filters.location}
                  onChange={(event) => updateFilter('location', event.target.value)}
                  placeholder="Cape Town"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" leadingIcon={<i className="ri-search-line" aria-hidden="true" />}>
                Apply filters
              </Button>
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <LoadingSkeletons />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<i className="ri-group-line text-3xl" aria-hidden="true" />}
            image="/images/app/empty-matches.webp"
            imageAlt="Two hands reaching gently toward each other"
            title="No matches yet"
            description="Add profile details or a condition report to give matching more signal."
            action={<LinkButton href="/settings">Update your profile</LinkButton>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {members.map((member) => (
              <MatchCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
