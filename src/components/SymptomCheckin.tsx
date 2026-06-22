'use client'

import { useEffect, useMemo, useState } from 'react'
import { DatabaseService } from '@/lib/database'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'

const STARTER = ['Fatigue', 'Pain', 'Anxiety', 'Brain fog', 'Poor sleep', 'Nausea', 'Headache', 'Low mood']
const LEVELS: Array<{ key: string; label: string; severity: number }> = [
  { key: 'mild', label: 'Mild', severity: 2 },
  { key: 'mod', label: 'Moderate', severity: 5 },
  { key: 'severe', label: 'Severe', severity: 8 },
]

/**
 * Fast, optional daily symptom capture. Tap a symptom, set how strong, save.
 * Writes via recordDailyCheckin (one severity row per symptom/day, the engine
 * collapses dupes), and never pops a "verdict", patterns live on /insights.
 */
export default function SymptomCheckin({ suggestions = [] }: { suggestions?: string[] }) {
  const [tracked, setTracked] = useState<string[]>([])
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    DatabaseService.getTrackedSymptoms()
      .then((r) => setTracked(Array.isArray(r) ? (r as string[]) : []))
      .catch(() => {})
  }, [])

  const chips = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of [...tracked, ...suggestions, ...STARTER]) {
      const value = s.trim()
      const key = value.toLowerCase()
      if (value && !seen.has(key)) {
        seen.add(key)
        out.push(value)
      }
    }
    return out.slice(0, 10)
  }, [tracked, suggestions])

  const toggle = (sym: string) =>
    setSelected((cur) => {
      const next = { ...cur }
      if (sym in next) delete next[sym]
      else next[sym] = 5
      return next
    })
  const setLevel = (sym: string, severity: number) => setSelected((cur) => ({ ...cur, [sym]: severity }))
  const addCustom = () => {
    const value = custom.trim()
    if (value && !(value in selected)) {
      setSelected((cur) => ({ ...cur, [value]: 5 }))
      setCustom('')
    }
  }

  const save = async () => {
    const symptoms = Object.entries(selected).map(([symptom, severity]) => ({ symptom, severity }))
    if (!symptoms.length || saving) return
    setSaving(true)
    try {
      await DatabaseService.recordDailyCheckin({ symptoms })
      setSelected({})
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
      const refreshed = await DatabaseService.getTrackedSymptoms()
      setTracked(Array.isArray(refreshed) ? (refreshed as string[]) : [])
    } catch (error) {
      console.error('Failed to save symptom check-in:', error)
    } finally {
      setSaving(false)
    }
  }

  const selectedEntries = Object.entries(selected)

  return (
    <div className="mt-5 border-t border-brand-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-ink">Anything in your body today?</p>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent3">
            <i className="ri-check-line" aria-hidden="true" /> Logged
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-brand-ink/55">Tap what you feel, set how strong. Optional, it quietly powers your patterns.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((sym) => {
          const active = sym in selected
          return (
            <button
              key={sym}
              type="button"
              onClick={() => toggle(sym)}
              aria-pressed={active}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
                active ? 'bg-brand-accent2 text-white' : 'bg-brand-ink/[0.06] text-brand-ink/75 hover:bg-brand-ink/[0.1]')}
            >
              {sym}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          placeholder="Add another…"
          aria-label="Add another symptom"
          className="input-field h-9 flex-1 text-sm"
        />
        <Button type="button" size="sm" variant="secondary" onClick={addCustom} disabled={!custom.trim()}>
          Add
        </Button>
      </div>

      {selectedEntries.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedEntries.map(([sym, sev]) => (
            <div key={sym} className="flex items-center justify-between gap-2 rounded-xl bg-brand-ink/[0.04] px-3 py-2">
              <span className="min-w-0 truncate text-sm text-brand-ink/85">{sym}</span>
              <div className="inline-flex shrink-0 rounded-full bg-brand-ink/[0.06] p-0.5 text-xs">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLevel(sym, l.severity)}
                    className={cn(
                      'rounded-full px-2.5 py-1 font-medium transition-colors',
                      sev === l.severity ? 'bg-brand-accent2 text-white' : 'text-brand-ink/60 hover:text-brand-ink')}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" size="sm" onClick={save} disabled={saving} fullWidth>
            {saving ? 'Saving…' : 'Save check-in'}
          </Button>
        </div>
      )}
    </div>
  )
}
