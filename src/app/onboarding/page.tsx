'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import PlatformAvatarPicker from '@/components/PlatformAvatarPicker'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { EncryptionService } from '@/lib/encryption'
import { resolveAvatarUrl } from '@/lib/profile-avatars'
import { StorageService } from '@/lib/storage'
import { Button, Input, Spinner, Alert } from '@/components/ui'

// ── Conversational answer sets (warm, non-invasive) ─────────────────────────
const REASONS = [
  { value: 'newly_diagnosed', label: 'Newly diagnosed', icon: 'ri-seedling-line' },
  { value: 'in_treatment', label: 'In treatment', icon: 'ri-capsule-line' },
  { value: 'managing', label: 'Managing day to day', icon: 'ri-sun-line' },
  { value: 'in_recovery', label: 'In recovery', icon: 'ri-route-line' },
  { value: 'caregiver', label: 'Supporting someone', icon: 'ri-hand-heart-line' },
  { value: 'grieving', label: 'Grieving a loss', icon: 'ri-cloud-line' },
  { value: 'exploring', label: 'Just exploring', icon: 'ri-compass-3-line' },
]

const FOCUS = [
  { value: 'understand', label: 'Understanding my condition', icon: 'ri-book-open-line' },
  { value: 'connect', label: 'Meeting people who get it', icon: 'ri-group-line' },
  { value: 'track', label: 'Tracking how I feel', icon: 'ri-line-chart-line' },
  { value: 'calm', label: 'Calmer, steadier days', icon: 'ri-mental-health-line' },
  { value: 'answers', label: 'Practical answers', icon: 'ri-lightbulb-line' },
  { value: 'vent', label: 'A place to vent', icon: 'ri-chat-smile-3-line' },
]

const MOODS = [
  { value: 'grounded', emoji: '🌿', label: 'Grounded' },
  { value: 'okay', emoji: '🙂', label: 'Okay' },
  { value: 'hopeful', emoji: '✨', label: 'Hopeful' },
  { value: 'tired', emoji: '😮‍💨', label: 'Tired' },
  { value: 'heavy', emoji: '🌧️', label: 'Heavy' },
  { value: 'numb', emoji: '🌫️', label: 'Numb' },
]

const CONDITION_SUGGESTIONS = [
  'Anxiety', 'Depression', 'PTSD', 'Bipolar', 'ADHD', 'Fibromyalgia',
  'Chronic Pain', 'Diabetes', 'HIV', 'Lupus', 'IBS', 'Migraine',
  'Arthritis', 'Cancer', 'Grief', 'Autism',
]

const ACCESS_NEED_SUGGESTIONS = [
  'Rest breaks',
  'Low glare',
  'Less motion',
  'Shorter text',
  'Sensory quiet',
  'Pain-aware planning',
  'Mobility support',
  'Transport help',
]

const STEPS = ['intro', 'reason', 'focus', 'mood', 'conditions', 'access', 'identity', 'done'] as const
type StepId = (typeof STEPS)[number]
const PROGRESS_STEPS: StepId[] = ['reason', 'focus', 'mood', 'conditions', 'access', 'identity']

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Answers
  const [reason, setReason] = useState('')
  const [focus, setFocus] = useState<string[]>([])
  const [mood, setMood] = useState('')
  const [conditions, setConditions] = useState<string[]>([])
  const [conditionInput, setConditionInput] = useState('')
  const [accessNeeds, setAccessNeeds] = useState<string[]>([])
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const step = STEPS[stepIndex]
  const firstName = (displayName || user?.displayName || '').split(' ')[0] || 'friend'

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    setDisplayName(user.displayName || '')
    ;(async () => {
      try {
        const profile = await DatabaseService.getProfile(user.userId)
        if (profile && (profile as Record<string, unknown>).onboarding_complete) {
          router.push('/dashboard')
          return
        }
      } catch {
        // best effort: let them onboard
      } finally {
        setCheckingProfile(false)
      }
    })()
  }, [user, authLoading, router])

  const go = (delta: number) => {
    setError('')
    setStepIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)))
  }

  const toggleFocus = (value: string) =>
    setFocus((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  const addCondition = (c: string) => {
    const t = c.trim()
    if (t && !conditions.includes(t)) setConditions((prev) => [...prev, t])
    setConditionInput('')
  }

  const toggleAccessNeed = (value: string) =>
    setAccessNeeds((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const validation = StorageService.validateFile(file, 5)
    if (!validation.valid) {
      setError(validation.error || 'That file did not work, try another.')
      return
    }
    setUploadingAvatar(true)
    setError('')
    try {
      const url = await StorageService.uploadProfileAvatar(user.userId, file)
      setAvatarUrl(url)
    } catch {
      setError('Could not upload that photo. Please try again.')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleSkipAll = async () => {
    if (!user) return
    setSaving(true)
    try {
      await DatabaseService.updateProfile(user.userId, { onboarding_complete: true })
    } catch {
      // proceed regardless
    }
    router.push('/dashboard')
  }

  const handleComplete = async () => {
    if (!user) return
    setError('')
    setSaving(true)
    try {
      const updates: Record<string, unknown> = { onboarding_complete: true, is_anonymous: isAnonymous }
      if (reason) updates.onboarding_status = reason
      if (focus.length) updates.interests = focus
      if (mood) {
        updates.daily_mood = mood
        updates.mood_updated_at = new Date().toISOString()
      }
      if (displayName.trim()) updates.full_name = displayName.trim()
      if (avatarUrl) updates.avatar_url = avatarUrl
      if (conditions.length || accessNeeds.length) {
        const key = await EncryptionService.getOrCreateUserKey(user.userId)
        const encrypted = await EncryptionService.encryptFields({ conditions, accessNeeds }, key)
        Object.assign(updates, encrypted)
      }
      await DatabaseService.updateProfile(user.userId, updates)
      setStepIndex(STEPS.indexOf('done'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-canvas">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="h-8 w-8 text-brand-accent2" />
          <p className="text-sm text-brand-ink/60">Getting things ready…</p>
        </div>
      </div>
    )
  }
  if (!user) return null

  const currentAvatarUrl = resolveAvatarUrl({
    avatar_url: avatarUrl,
    full_name: displayName || user.displayName || '',
    userId: user.userId,
    username: user.username,
  })
  const progressPct = step === 'done' ? 100 : (PROGRESS_STEPS.indexOf(step) + 1) / (PROGRESS_STEPS.length + 1) * 100

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-canvas">
      {/* Soft, STATIC ambient tints. Note: avoid animated + heavily-blurred
          layers here — a large animated blur (breathing-gradient + blur-[130px])
          corrupts GPU compositing on throttled mobile devices (renders as static
          over the avatar picker). Keep these cheap and non-animated. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand-accent2/[0.06] blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-brand-accent3/[0.06] blur-2xl" />

      {/* Top bar: logo + progress + skip */}
      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center gap-4 px-5 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="KinSpace home">
          <Image src="/images/gather_logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" priority />
          <span className="text-base font-black tracking-tight text-brand-ink">KinSpace</span>
        </Link>
        {step !== 'intro' && step !== 'done' && (
          <>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-ink/10">
              <div className="h-full rounded-full bg-brand-accent2 transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
            <button type="button" onClick={handleSkipAll} className="shrink-0 text-sm font-medium text-brand-ink/45 transition-colors hover:text-brand-ink/70">
              Skip
            </button>
          </>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 pb-12 sm:px-6">
        <div key={step} className="animate-step-in">
          {/* ── Intro ── */}
          {step === 'intro' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-accent2/15 animate-pop">
                <i className="ri-hand-heart-line text-4xl text-brand-accent2" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-brand-ink sm:text-4xl">
                Hi {firstName}, welcome in.
              </h1>
              <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-brand-ink/65">
                A few quick, friendly questions so KinSpace feels like yours. No wrong answers, nothing is required,
                and you can change anything later.
              </p>
              <div className="mx-auto mt-7 flex max-w-md flex-col gap-2.5 text-left">
                {[
                  { icon: 'ri-timer-line', text: 'Takes about a minute' },
                  { icon: 'ri-shield-keyhole-line', text: 'Health details are encrypted, only you can read them' },
                  { icon: 'ri-eye-off-line', text: 'Stay anonymous if that feels better' },
                ].map((r) => (
                  <div key={r.text} className="flex items-center gap-3 rounded-2xl bg-brand-surface/70 px-4 py-3 ring-1 ring-brand-line">
                    <i className={`${r.icon} text-lg text-brand-accent3`} aria-hidden="true" />
                    <span className="text-sm text-brand-ink/75">{r.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Button type="button" size="lg" onClick={() => go(1)} className="px-10">
                  Let&rsquo;s begin <i className="ri-arrow-right-line" aria-hidden="true" />
                </Button>
              </div>
              <button type="button" onClick={handleSkipAll} className="mt-4 text-sm text-brand-ink/45 hover:text-brand-ink/70">
                Skip and go to my dashboard
              </button>
            </div>
          )}

          {/* ── Reason ── */}
          {step === 'reason' && (
            <StepShell
              title="What brings you to KinSpace?"
              hint="Pick whatever fits best right now. This just helps us meet you where you are."
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {REASONS.map((r) => (
                  <SelectChip key={r.value} icon={r.icon} label={r.label} selected={reason === r.value} onClick={() => setReason(r.value)} />
                ))}
              </div>
              <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={!reason} />
            </StepShell>
          )}

          {/* ── Focus ── */}
          {step === 'focus' && (
            <StepShell title="What would help most?" hint="Choose as many as you like. We will gently shape your space around these.">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {FOCUS.map((f) => (
                  <SelectChip key={f.value} icon={f.icon} label={f.label} selected={focus.includes(f.value)} onClick={() => toggleFocus(f.value)} multi />
                ))}
              </div>
              <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextLabel={focus.length ? 'Continue' : 'Skip'} />
            </StepShell>
          )}

          {/* ── Mood ── */}
          {step === 'mood' && (
            <StepShell title={`How are you arriving today, ${firstName}?`} hint="No pressure, this is just a gentle check-in. You can update it any time.">
              <div className="grid grid-cols-3 gap-2.5">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 transition-all active:scale-95 ${
                      mood === m.value
                        ? 'border-brand-accent2 bg-brand-accent2/10 ring-2 ring-brand-accent2/40'
                        : 'border-brand-line bg-brand-surface/70 hover:border-brand-line-strong'
                    }`}
                  >
                    <span className="text-3xl">{m.emoji}</span>
                    <span className="text-sm font-medium text-brand-ink/75">{m.label}</span>
                  </button>
                ))}
              </div>
              <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextLabel={mood ? 'Continue' : 'Skip'} />
            </StepShell>
          )}

          {/* ── Conditions ── */}
          {step === 'conditions' && (
            <StepShell
              title="Anything you're navigating?"
              hint="Totally optional, and end-to-end encrypted, only you can ever read it. Skip if you'd rather not say."
            >
              {conditions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {conditions.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent2/12 px-3 py-1.5 text-sm font-medium text-brand-accent2 animate-pop">
                      {c}
                      <button type="button" onClick={() => setConditions((p) => p.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="hover:text-brand-accent1">
                        <i className="ri-close-line text-xs" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCondition(conditionInput)
                  }
                }}
                aria-label="Add what you're navigating"
                placeholder="Type and press Enter, or pick below"
              />
              <div className="flex flex-wrap gap-1.5">
                {CONDITION_SUGGESTIONS.filter((s) => !conditions.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addCondition(s)}
                    className="rounded-full bg-brand-ink/[0.05] px-3 py-1.5 text-sm text-brand-ink/60 transition-colors hover:bg-brand-ink/10 hover:text-brand-ink"
                  >
                    + {s}
                  </button>
                ))}
              </div>
              <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextLabel={conditions.length ? 'Continue' : 'Skip'} />
            </StepShell>
          )}

          {/* ── Identity ── */}
          {step === 'access' && (
            <StepShell
              title="What helps KinSpace fit your day?"
              hint="Optional. Pick anything that makes care, reading, planning, or connection easier."
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ACCESS_NEED_SUGGESTIONS.map((need) => {
                  const selected = accessNeeds.includes(need)
                  return (
                    <button
                      key={need}
                      type="button"
                      onClick={() => toggleAccessNeed(need)}
                      aria-pressed={selected}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all active:scale-95 ${
                        selected
                          ? 'border-brand-accent5 bg-brand-accent5/12 text-brand-ink ring-2 ring-brand-accent5/25'
                          : 'border-brand-line bg-brand-surface/70 text-brand-ink/72 hover:border-brand-line-strong'
                      }`}
                    >
                      <i className="ri-universal-access-line text-lg text-brand-accent5" aria-hidden="true" />
                      <span className="font-medium">{need}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs leading-relaxed text-brand-ink/60">
                This stays on your private profile. The Guide can use it only when health sharing is on.
              </p>
              <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextLabel={accessNeeds.length ? 'Continue' : 'Skip'} />
            </StepShell>
          )}

          {step === 'identity' && (
            <StepShell title="Make it yours" hint="Pick a look and a name. You can stay anonymous in the community whenever you want.">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ring-2 ring-brand-line">
                    <ProfileAvatar alt="Your avatar" avatarUrl={avatarUrl} className="h-full w-full object-cover" fullName={displayName || user.displayName || ''} userId={user.userId} username={user.username} />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                        <Spinner className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Upload a photo"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent2 text-white shadow-sm transition-colors hover:bg-brand-accent2/90"
                  >
                    <i className="ri-camera-line" aria-hidden="true" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
                </div>
                <PlatformAvatarPicker disabled={uploadingAvatar} onSelect={(url) => setAvatarUrl(url)} selectedAvatarUrl={currentAvatarUrl} />
              </div>

              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="Display name" placeholder="A name or nickname" />

              <button
                type="button"
                onClick={() => setIsAnonymous((v) => !v)}
                className="flex w-full items-center gap-3 rounded-2xl bg-brand-surface/70 p-3.5 text-left ring-1 ring-brand-line transition-colors hover:ring-brand-line-strong"
              >
                <span role="switch" aria-checked={isAnonymous} className={`flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${isAnonymous ? 'bg-brand-accent2' : 'bg-brand-ink/20'}`}>
                  <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isAnonymous ? 'translate-x-5' : 'translate-x-1'}`} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-brand-ink">Stay anonymous</span>
                  <span className="block text-xs text-brand-ink/55">Your name stays hidden, you appear by username only.</span>
                </span>
              </button>

              {error && <Alert tone="error">{error}</Alert>}
              <StepNav onBack={() => go(-1)} onNext={handleComplete} nextLabel={saving ? 'Setting up…' : 'Finish'} nextLoading={saving} nextAccent />
            </StepShell>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="relative text-center">
              {/* confetti */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-4 mx-auto flex max-w-xs justify-between">
                {['🌿', '✨', '💚', '🌼', '🤍', '🌱', '✨'].map((c, i) => (
                  <span key={i} className="animate-confetti text-xl" style={{ animationDelay: `${i * 90}ms` }}>{c}</span>
                ))}
              </div>
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-brand-accent3/15 animate-pop">
                <i className="ri-check-line text-5xl text-brand-accent3" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-brand-ink sm:text-4xl">You&rsquo;re all set, {firstName}.</h1>
              <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-brand-ink/65">
                Your space is ready. Everything you just shared is yours to change any time from settings.
              </p>
              <div className="mt-8">
                <Button type="button" size="lg" variant="accent" onClick={() => router.push('/dashboard')} className="px-10">
                  Enter KinSpace <i className="ri-arrow-right-line" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Small building blocks ───────────────────────────────────────────────────
function StepShell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-black tracking-tight text-brand-ink sm:text-3xl">{title}</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-brand-ink/60">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function SelectChip({ icon, label, selected, onClick, multi }: { icon: string; label: string; selected: boolean; onClick: () => void; multi?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98] ${
        selected
          ? 'border-brand-accent2 bg-brand-accent2/10 ring-2 ring-brand-accent2/40'
          : 'border-brand-line bg-brand-surface/70 hover:border-brand-line-strong'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-brand-accent2/20 text-brand-accent2' : 'bg-brand-ink/[0.05] text-brand-ink/50'}`}>
        <i className={icon} aria-hidden="true" />
      </span>
      <span className="flex-1 text-sm font-medium text-brand-ink">{label}</span>
      {multi ? (
        <i className={`${selected ? 'ri-checkbox-circle-fill text-brand-accent2' : 'ri-checkbox-blank-circle-line text-brand-ink/25'}`} aria-hidden="true" />
      ) : (
        selected && <i className="ri-check-line text-brand-accent2" aria-hidden="true" />
      )}
    </button>
  )
}

function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  nextLoading,
  nextAccent,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  nextAccent?: boolean
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="button" variant="secondary" onClick={onBack} leadingIcon={<i className="ri-arrow-left-line" aria-hidden="true" />}>
        Back
      </Button>
      <Button type="button" variant={nextAccent ? 'accent' : 'primary'} onClick={onNext} disabled={nextDisabled} isLoading={nextLoading} fullWidth>
        {nextLabel}
      </Button>
    </div>
  )
}
