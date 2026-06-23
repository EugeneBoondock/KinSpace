'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

type Command = {
  id: string
  label: string
  hint: string
  icon: string
  keywords: string
  href: (query: string) => string
}

// The one place to do anything in KinSpace. Each pillar is reachable here so the
// app feels like a single surface, not a bundle of tools. Ordered by everyday use.
const COMMANDS: Command[] = [
  { id: 'ask', label: 'Ask the AI a question', hint: 'An evidence-based answer', icon: 'ri-sparkling-2-line', keywords: 'ask ai question why how what answer help search', href: (q) => (q ? `/ask?q=${encodeURIComponent(q)}` : '/ask') },
  { id: 'symptom', label: 'Check symptoms', hint: 'Guided and emergency-first', icon: 'ri-stethoscope-line', keywords: 'symptom symptoms sick pain feel unwell checker triage diagnose', href: () => '/symptom-checker' },
  { id: 'conditions', label: 'What works for a condition', hint: 'Treatment evidence and member reports', icon: 'ri-microscope-line', keywords: 'condition treatment what works evidence study manage cure stuffthatworks cochrane', href: () => '/conditions' },
  { id: 'people', label: 'Find people like you', hint: 'Matched on your health, privately', icon: 'ri-group-2-line', keywords: 'people like me similar match peers find connect', href: () => '/people-like-you' },
  { id: 'lantern', label: 'Talk to someone now', hint: 'On-demand peer support', icon: 'ri-lightbulb-flash-line', keywords: 'talk someone lonely lantern peer support help now', href: () => '/support' },
  { id: 'guide', label: 'Talk to the Guide', hint: 'Your private AI companion', icon: 'ri-chat-heart-line', keywords: 'guide therapy vent anxious therapist talk chat counsel', href: () => '/therapy' },
  { id: 'breathe', label: 'Breathe / calm', hint: 'Guided breathing and grounding', icon: 'ri-lungs-line', keywords: 'breathe breathing calm relax meditation mindfulness grounding anxiety panic sleep headspace', href: () => '/mindfulness' },
  { id: 'checkin', label: 'Daily check-in', hint: 'Log how today feels', icon: 'ri-emotion-line', keywords: 'mood check in today feeling log track', href: () => '/dashboard' },
  { id: 'meds', label: 'Medication shelf', hint: 'Reminders and adherence', icon: 'ri-capsule-line', keywords: 'med medication pill reminder dose adherence shelf refill', href: () => '/dashboard?meds=1' },
  { id: 'insights', label: 'Personal insights', hint: 'Your patterns and correlations', icon: 'ri-line-chart-line', keywords: 'insights trends correlation patterns tracking bearable', href: () => '/insights' },
  { id: 'community', label: 'Community feed', hint: 'Share and reply', icon: 'ri-discuss-line', keywords: 'community feed posts share talk', href: () => '/community' },
  { id: 'groups', label: 'Your groups', hint: 'Circles and live sessions', icon: 'ri-team-line', keywords: 'group circle support groups sessions', href: () => '/groups' },
  { id: 'research', label: 'Research library', hint: 'Latest evidence, plain language', icon: 'ri-flask-line', keywords: 'research study pubmed cochrane evidence latest breakthrough', href: () => '/research' },
  { id: 'care', label: 'Find care nearby', hint: 'Doctors, clinics, hospitals, pharmacies', icon: 'ri-map-pin-2-line', keywords: 'doctor clinic hospital pharmacy care nearby find provider appointment zocdoc healthgrades map', href: () => '/care' },
  { id: 'saved', label: 'Saved items', hint: 'Your bookmarks', icon: 'ri-bookmark-line', keywords: 'saved bookmark bookmarks read later', href: () => '/saved' },
  { id: 'connections', label: 'Connections', hint: 'People you follow', icon: 'ri-links-line', keywords: 'connections strands friends follow people', href: () => '/strands' },
  { id: 'settings', label: 'Settings', hint: 'Profile and privacy', icon: 'ri-settings-3-line', keywords: 'settings profile account privacy preferences', href: () => '/settings' },
]

export default function CommandLauncher() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const askItem: Command = {
      id: 'ask-freeform',
      label: query.trim() ? `Ask the AI: “${query.trim()}”` : 'Ask the AI a question',
      hint: 'An evidence-based answer',
      icon: 'ri-sparkling-2-line',
      keywords: '',
      href: (value) => (value ? `/ask?q=${encodeURIComponent(value)}` : '/ask'),
    }
    if (!q) return COMMANDS
    const matched = COMMANDS.map((command) => {
      const hay = `${command.label} ${command.keywords}`.toLowerCase()
      const score = command.label.toLowerCase().includes(q) ? 2 : hay.includes(q) ? 1 : 0
      return { command, score }
    })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command)
    return [...matched, askItem]
  }, [query])

  if (loading || !user) return null

  function go(command: Command) {
    setOpen(false)
    router.push(command.href(query.trim()))
  }

  function onInputKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, list.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = list[active] ?? list[0]
      if (target) go(target)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask KinSpace"
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-[70] inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-[0_14px_32px_rgba(16,28,24,0.22)] transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40 md:bottom-6"
      >
        <i className="ri-sparkling-2-line text-base text-brand-accent2" aria-hidden="true" />
        <span className="hidden sm:inline">Ask KinSpace</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-brand-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-brand-line bg-brand-surface shadow-[0_32px_80px_rgba(16,28,24,0.4)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Ask KinSpace"
          >
            <div className="flex items-center gap-2 border-b border-brand-line px-4">
              <i className="ri-search-line text-brand-ink/40" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKey}
                placeholder="Ask anything, or jump anywhere…"
                aria-label="Ask KinSpace or jump to a feature"
                className="w-full bg-transparent py-4 text-base text-brand-ink placeholder:text-brand-ink/40 focus:outline-none"
              />
            </div>
            <ul className="max-h-[55vh] overflow-y-auto p-2">
              {list.map((command, index) => (
                <li key={command.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(command)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      index === active ? 'bg-brand-accent2/12' : 'hover:bg-brand-ink/[0.04]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        index === active ? 'bg-brand-accent2/20 text-brand-accent2' : 'bg-brand-ink/[0.06] text-brand-ink/60'
                      }`}
                    >
                      <i className={`${command.icon} text-lg`} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-brand-ink">{command.label}</span>
                      <span className="block truncate text-xs text-brand-ink/55">{command.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-brand-line px-4 py-2 text-[11px] text-brand-ink/45">
              <span>↑ ↓ to navigate, Enter to open</span>
              <span>Ctrl / ⌘ K</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
