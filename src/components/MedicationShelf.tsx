'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import {
  getDueMedicationReminderSlots,
  normalizeReminderTimes,
  resolveReminderTimesForSave,
  type MedicationReminderSchedule,
} from '@/lib/medication-reminders'
import { useToast } from '@/components/Toast'
import { playSfx } from '@/lib/audio/sfx'
import { enablePush, disablePush, getPushStatus, type PushStatus } from '@/lib/push/client'
import { Alert, Badge, Button, Drawer, Field, Input, Select, SelectOption, Spinner, SwitchRow } from '@/components/ui'

type MedicationReminderRow = MedicationReminderSchedule & {
  user_id?: string
  last_taken_at?: string | null
  created_at?: string
  updated_at?: string
}

type AdherenceRow = {
  id: string
  taken_days: number
  expected_days: number
  adherence_pct: number
  recent: Array<boolean | null>
}

type ReminderForm = {
  id: string | null
  medication: string
  dose: string
  frequency: string
  timingHint: string
  times: string[]
  active: boolean
}

type ActiveReminderAlert = {
  reminder: MedicationReminderRow
  time: string
  ackKey: string
}

type BrowserReminderNotificationOptions = NotificationOptions & {
  actions?: Array<{ action: string; title: string }>
  renotify?: boolean
  timestamp?: number
  vibrate?: number[]
}

type SuggestionResponse = {
  ok?: boolean
  source?: 'ai' | 'fallback'
  times?: string[]
  note?: string
  error?: string
}

type MedConfidence = 'high' | 'medium' | 'low'

type MedicationIdentification = {
  name: string
  generic_name: string | null
  drug_class: string | null
  used_for: string[]
  common_benefits: string[]
  common_side_effects: string[]
  serious_warnings: string[]
  interactions: string[]
  ask_your_doctor: string[]
  confidence: MedConfidence
  disclaimer: string
}

type DrugFacts = {
  matched_name: string | null
  boxed_warning: string | null
  patient_reported_reactions: Array<{ term: string; count: number }>
  medlineplus_url: string | null
  sources: Array<{ title: string; url: string; kind: 'fda' | 'medlineplus' | 'rxnorm' }>
}

type IdentifyResponse = {
  ok?: boolean
  medication?: MedicationIdentification
  facts?: DrugFacts | null
  error?: string
}

// ~4.5MB source image leaves headroom under the route data cap.
const MAX_IDENTIFY_FILE_BYTES = 4.5 * 1024 * 1024

const confidenceLabels: Record<MedConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

const confidenceTones: Record<MedConfidence, 'success' | 'warning' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('Could not read the image.'))
    }
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}

const emptyForm: ReminderForm = {
  id: null,
  medication: '',
  dose: '',
  frequency: 'once daily',
  timingHint: '',
  times: ['08:00'],
  active: true,
}

const ACK_PREFIX = 'kinspace:med-reminder:'
const DUE_WAKE_WINDOW_MINUTES = 6
const ACTIVE_ALERT_REPEAT_MS = 9_000
const ACTIVE_ALERT_REPEAT_LIMIT = 8
const REMINDER_VIBRATION = [700, 250, 700, 250, 700, 500, 900]

function storageKey(ackKey: string) {
  return `${ACK_PREFIX}${ackKey}`
}

function parseReminderAckKey(ackKey: string): { dateKey: string; reminderId: string; time: string } | null {
  const [dateKey, reminderId, hour, minute] = ackKey.split(':')
  if (!dateKey || !reminderId || !hour || !minute) return null
  return { dateKey, reminderId, time: `${hour}:${minute}` }
}

function playReminderTone() {
  // Centralized so it honors the global sound toggle (Settings -> Sounds).
  playSfx('reminder')
}

function vibrateReminder() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(REMINDER_VIBRATION)
}

function formatTimes(times: string[]) {
  return normalizeReminderTimes(times).join(', ')
}

// True when last_taken_at falls on today's local date, which drives the clear
// "Taken today" vs "Not taken yet" distinction on the shelf.
function isTakenToday(value?: string | null): boolean {
  if (!value) return false
  const trimmed = String(value).trim()
  const asNumber = Number(trimmed)
  const date = Number.isFinite(asNumber) && String(asNumber) === trimmed ? new Date(asNumber) : new Date(trimmed)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export default function MedicationShelf() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reminders, setReminders] = useState<MedicationReminderRow[]>([])
  const [adherence, setAdherence] = useState<Record<string, AdherenceRow>>({})
  const [form, setForm] = useState<ReminderForm>(emptyForm)
  const [timeInput, setTimeInput] = useState('08:00')
  const [loadingReminders, setLoadingReminders] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushStatus, setPushStatus] = useState<PushStatus>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testingLocalAlarm, setTestingLocalAlarm] = useState(false)
  const [activeAlert, setActiveAlert] = useState<ActiveReminderAlert | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [identifyError, setIdentifyError] = useState<string | null>(null)
  const [identifiedMed, setIdentifiedMed] = useState<MedicationIdentification | null>(null)
  const [identifiedFacts, setIdentifiedFacts] = useState<DrugFacts | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const timeInputRef = useRef<HTMLInputElement | null>(null)
  const addFormRef = useRef<HTMLElement | null>(null)

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => a.medication.localeCompare(b.medication)),
    [reminders],
  )
  const deviceAlarmStatus = useMemo(() => {
    if (pushStatus === 'granted-subscribed') {
      return {
        tone: 'success' as const,
        label: 'Device alarms on',
        body: 'KinSpace can alert this device at dose time, including when the app is closed.',
        closedApp: 'On',
      }
    }
    if (pushStatus === 'granted-refresh-needed') {
      return {
        tone: 'warning' as const,
        label: 'Device alarms need refresh',
        body: 'Refresh this device so closed-app medication reminders can ring again.',
        closedApp: 'Refresh needed',
      }
    }
    if (pushStatus === 'server-unconfigured') {
      return {
        tone: 'warning' as const,
        label: 'Device alarms paused',
        body: 'Background reminder service is not ready. Try again in a few minutes.',
        closedApp: 'Paused',
      }
    }
    if (pushStatus === 'denied' || permission === 'denied') {
      return {
        tone: 'warning' as const,
        label: 'Notifications blocked',
        body: 'Turn on notifications in browser settings to receive medication alarms on this device.',
        closedApp: 'Blocked',
      }
    }
    if (pushStatus === 'unsupported' || permission === 'unsupported') {
      return {
        tone: 'neutral' as const,
        label: 'Browser support missing',
        body: 'Use a browser with notifications and service workers for closed-app medication alarms.',
        closedApp: 'Unsupported',
      }
    }
    if (permission === 'granted') {
      return {
        tone: 'warning' as const,
        label: 'Open-app alerts on',
        body: 'KinSpace can alert while open. Turn on device alarms for closed-app reminders on this device.',
        closedApp: 'Needs setup',
      }
    }
    return {
      tone: 'warning' as const,
      label: 'Device alarms off',
      body: 'Turn on notifications to receive medication alarms on this device.',
      closedApp: 'Needs setup',
    }
  }, [permission, pushStatus])

  const loadReminders = useCallback(async () => {
    if (!user) return
    setLoadingReminders(true)
    try {
      const [data, adherenceRows] = await Promise.all([
        DatabaseService.getMedicationReminders(user.userId) as Promise<MedicationReminderRow[]>,
        (DatabaseService.getMedicationAdherence(user.userId, 14) as Promise<AdherenceRow[]>).catch(
          () => [] as AdherenceRow[],
        ),
      ])
      setReminders(data.map((item) => ({ ...item, times: normalizeReminderTimes(item.times ?? []) })))
      const map: Record<string, AdherenceRow> = {}
      for (const row of adherenceRows ?? []) map[row.id] = row
      setAdherence(map)
    } catch {
      toast.push('Could not load medication reminders.', 'error')
    } finally {
      setLoadingReminders(false)
    }
  }, [toast, user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPermission('Notification' in window ? Notification.permission : 'unsupported')
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPushStatus()
      .then(async (status) => {
        if (cancelled) return
        setPushStatus(status)
        if (status !== 'granted-refresh-needed') return

        const result = await enablePush({ requestPermission: false })
        if (cancelled) return
        setPushStatus(result.ok ? 'granted-subscribed' : await getPushStatus())
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])

  // A reminder notification's "Taken" action deep-links here with ?meds=1.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('meds') === '1') setOpen(true)
  }, [])

  async function handleEnablePush() {
    setPushBusy(true)
    try {
      const result = await enablePush()
      if (result.ok) {
        setPushStatus('granted-subscribed')
        toast.push('Device alarms are on for this device.', 'success')
      } else {
        toast.push(result.error || 'Could not turn on background reminders.', 'error')
        setPushStatus(await getPushStatus())
      }
    } finally {
      setPushBusy(false)
    }
  }

  async function handleDisablePush() {
    setPushBusy(true)
    try {
      await disablePush()
      setPushStatus('granted-unsubscribed')
      toast.push('Background reminders turned off for this device.', 'info')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleTestPush() {
    setTestingPush(true)
    try {
      const result = (await DatabaseService.sendTestPush()) as { ok?: boolean; error?: string }
      if (result?.ok) toast.push('Test reminder sent. Check your notifications.', 'success')
      else toast.push(result?.error || 'Could not send a test reminder.', 'error')
    } catch {
      toast.push('Could not send a test reminder.', 'error')
    } finally {
      setTestingPush(false)
    }
  }

  async function handleTestLocalAlarm() {
    setTestingLocalAlarm(true)
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPermission('unsupported')
        toast.push('This browser does not support notification alarms.', 'error')
        return
      }

      let currentPermission = Notification.permission
      if (currentPermission !== 'granted') {
        currentPermission = await Notification.requestPermission()
        setPermission(currentPermission)
      }

      if (currentPermission !== 'granted') {
        toast.push('Notification permission is needed for alarm tests.', 'info')
        return
      }

      await showDeviceNotification('KinSpace reminder test', {
        body: 'This device can show persistent medication reminders.',
        tag: 'kinspace-local-alarm-test',
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: REMINDER_VIBRATION,
        icon: '/images/gather_logo.png',
        badge: '/images/gather_logo.png',
        timestamp: Date.now(),
        data: { url: '/dashboard?meds=1', kind: 'med-reminder', alarmTest: true },
      })
      playReminderTone()
      vibrateReminder()
      window.setTimeout(() => {
        playReminderTone()
        vibrateReminder()
      }, 900)
      window.setTimeout(() => {
        playReminderTone()
        vibrateReminder()
      }, 1800)
      toast.push('Alarm test sent on this device.', 'success')
    } finally {
      setTestingLocalAlarm(false)
    }
  }

  useEffect(() => {
    if (!loading && user) loadReminders()
  }, [loadReminders, loading, user])

  const showDeviceNotification = useCallback(async (title: string, options: BrowserReminderNotificationOptions) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null)
      if (registration) {
        await registration.showNotification(title, options)
        return
      }
    }

    new Notification(title, options)
  }, [])

  const showBrowserReminder = useCallback(async (slot: ActiveReminderAlert) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    const title = 'Medication reminder'
    const body = `${slot.reminder.medication}${slot.reminder.dose ? `, ${slot.reminder.dose}` : ''} at ${slot.time}`
    const slotParts = parseReminderAckKey(slot.ackKey)
    const options: BrowserReminderNotificationOptions = {
      body,
      tag: slot.ackKey,
      requireInteraction: true,
      renotify: true,
      silent: false,
      vibrate: REMINDER_VIBRATION,
      actions: [
        { action: 'taken', title: 'Taken' },
        { action: 'snooze', title: 'Snooze 10m' },
      ],
      icon: '/images/gather_logo.png',
      badge: '/images/gather_logo.png',
      data: {
        url: '/dashboard?meds=1',
        kind: 'med-reminder',
        reminderId: slot.reminder.id,
        time: slot.time,
        dateKey: slotParts?.dateKey,
      },
    }

    await showDeviceNotification(title, options)
  }, [showDeviceNotification])

  const checkDueReminders = useCallback(() => {
    if (typeof window === 'undefined' || reminders.length === 0) return

    const now = new Date()
    const dueSlots = getDueMedicationReminderSlots(reminders, now, new Set(), DUE_WAKE_WINDOW_MINUTES)
      .filter((slot) => !window.localStorage.getItem(storageKey(slot.ackKey)))

    for (const slot of dueSlots) {
      window.localStorage.setItem(storageKey(slot.ackKey), String(Date.now()))
      const alertSlot = slot as ActiveReminderAlert
      setActiveAlert(alertSlot)
      toast.push(`Time for ${slot.reminder.medication}.`, 'info')
      playReminderTone()
      vibrateReminder()
      showBrowserReminder(alertSlot).catch(() => undefined)
    }
  }, [reminders, showBrowserReminder, toast])

  useEffect(() => {
    if (!activeAlert) return
    let count = 0
    const interval = window.setInterval(() => {
      count += 1
      if (count > ACTIVE_ALERT_REPEAT_LIMIT) {
        window.clearInterval(interval)
        return
      }
      playReminderTone()
      vibrateReminder()
    }, ACTIVE_ALERT_REPEAT_MS)
    return () => {
      window.clearInterval(interval)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(0)
    }
  }, [activeAlert])

  useEffect(() => {
    if (!user) return
    checkDueReminders()
    const interval = window.setInterval(checkDueReminders, 30_000)
    return () => window.clearInterval(interval)
  }, [checkDueReminders, user])

  function resetForm() {
    setForm(emptyForm)
    setTimeInput('08:00')
    setSuggestionNote(null)
  }

  function editReminder(reminder: MedicationReminderRow) {
    const times = normalizeReminderTimes(reminder.times ?? [])
    setForm({
      id: reminder.id,
      medication: reminder.medication,
      dose: reminder.dose ?? '',
      frequency: 'custom',
      timingHint: '',
      times,
      active: reminder.active,
    })
    setTimeInput(times[0] ?? '08:00')
    setSuggestionNote(null)
    setOpen(true)
  }

  function addTime() {
    const times = normalizeReminderTimes([...form.times, timeInput])
    if (times.length === form.times.length && form.times.includes(timeInput)) return
    setForm((current) => ({ ...current, times }))
  }

  function removeTime(time: string) {
    setForm((current) => ({ ...current, times: current.times.filter((item) => item !== time) }))
  }

  async function suggestTimes() {
    setSuggesting(true)
    setSuggestionNote(null)
    try {
      const response = await fetch('/api/medications/suggest-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medication: form.medication,
          dose: form.dose,
          frequency: form.frequency,
          timingHint: form.timingHint,
        }),
      })
      const json = (await response.json().catch(() => null)) as SuggestionResponse | null
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Suggestion failed')

      const times = normalizeReminderTimes(json.times ?? [])
      if (times.length === 0) throw new Error('No times returned')

      setForm((current) => ({ ...current, times }))
      setTimeInput(times[0])
      setSuggestionNote(json.note || 'Review these reminder times before saving.')
      toast.push(json.source === 'ai' ? 'AI suggested reminder times.' : 'Suggested reminder times.', 'success')
    } catch {
      toast.push('Could not suggest times right now.', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  function openIdentifyPicker() {
    setIdentifyError(null)
    fileInputRef.current?.click()
  }

  function dismissIdentification() {
    setIdentifiedMed(null)
    setIdentifiedFacts(null)
    setIdentifyError(null)
  }

  // Carry an identified medication straight into the reminder form. Saving it
  // both schedules reminders and records that the user takes this med, which the
  // Guide can then see (when health sharing is on).
  function addIdentifiedToReminders(med: MedicationIdentification) {
    setForm({
      id: null,
      medication: med.name,
      dose: '',
      frequency: 'once daily',
      timingHint: '',
      times: ['08:00'],
      active: true,
    })
    setTimeInput('08:00')
    setSuggestionNote(null)
    setIdentifiedMed(null)
    setIdentifiedFacts(null)
    setIdentifyError(null)
    toast.push('Added below. Set the dose and times, then save.', 'success')
    requestAnimationFrame(() =>
      addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  async function handleIdentifyFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so picking the same file again re-triggers onChange.
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setIdentifyError('Please choose an image file.')
      return
    }
    if (file.size > MAX_IDENTIFY_FILE_BYTES) {
      setIdentifyError('That image is too large. Please use one under about 4.5MB.')
      return
    }

    setIdentifying(true)
    setIdentifyError(null)
    setIdentifiedMed(null)
    setIdentifiedFacts(null)

    try {
      const image = await readFileAsDataUrl(file)
      const response = await fetch('/api/meds/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const json = (await response.json().catch(() => null)) as IdentifyResponse | null

      if (!response.ok || !json?.ok || !json.medication) {
        throw new Error(json?.error || 'Could not identify this medication.')
      }

      setIdentifiedMed(json.medication)
      setIdentifiedFacts(json.facts ?? null)
      toast.push('Here is what we found about this medication.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not identify this medication.'
      setIdentifyError(message)
    } finally {
      setIdentifying(false)
    }
  }

  async function saveReminder() {
    if (!user) return

    const times = resolveReminderTimesForSave(form.times, timeInputRef.current?.value || timeInput)
    if (!form.medication.trim() || times.length === 0) {
      toast.push('Add a medication name and at least one time.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        medication: form.medication.trim(),
        dose: form.dose.trim() || null,
        times,
        active: form.active,
      }

      if (form.id) {
        await DatabaseService.updateMedicationReminder(user.userId, form.id, payload)
        toast.push('Medication reminder updated.', 'success')
      } else {
        await DatabaseService.createMedicationReminder(user.userId, payload)
        toast.push('Medication reminder saved.', 'success')
      }

      resetForm()
      await loadReminders()
    } catch {
      toast.push('Could not save medication reminder.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReminder(reminderId: string) {
    if (!user) return
    try {
      await DatabaseService.deleteMedicationReminder(user.userId, reminderId)
      setReminders((current) => current.filter((item) => item.id !== reminderId))
      if (form.id === reminderId) resetForm()
      toast.push('Medication reminder deleted.', 'success')
    } catch {
      toast.push('Could not delete reminder.', 'error')
    }
  }

  async function markTaken(reminder: MedicationReminderRow, time?: string, ackKey?: string) {
    if (!user) return
    try {
      await DatabaseService.markMedicationReminderTaken(user.userId, reminder.id)
      if (ackKey) {
        window.localStorage.setItem(storageKey(ackKey), String(Date.now()))
        const slotParts = parseReminderAckKey(ackKey)
        if (slotParts && slotParts.reminderId === reminder.id) {
          await DatabaseService.ackMedicationReminderSlot(
            user.userId,
            reminder.id,
            slotParts.dateKey,
            slotParts.time,
          ).catch(() => undefined)
        }
      }
      setActiveAlert(null)
      await loadReminders()
      toast.push('Marked as taken.', 'success')
    } catch {
      toast.push('Could not mark this as taken.', 'error')
    }
  }

  if (loading || !user) return null

  return (
    <>
      {activeAlert && (
        <div className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[85] mx-auto max-w-md rounded-2xl border border-brand-accent2/30 bg-brand-surface p-4 text-brand-ink shadow-[0_18px_42px_rgba(16,28,24,0.24)] md:bottom-6 md:left-auto md:right-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent2/15 text-brand-accent2">
              <i className="ri-capsule-line text-xl" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Time for {activeAlert.reminder.medication}</p>
              <p className="mt-1 text-xs text-brand-ink/60">
                {activeAlert.reminder.dose ? `${activeAlert.reminder.dose} at ${activeAlert.time}` : activeAlert.time}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => markTaken(activeAlert.reminder, activeAlert.time, activeAlert.ackKey)}>
                  Taken
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setActiveAlert(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slim edge tab that keeps the shelf reachable without covering content. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open medication shelf"
        className="fixed right-0 top-1/2 z-40 flex h-16 w-9 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-brand-line bg-brand-surface text-brand-accent1 shadow-[0_14px_32px_rgba(16,28,24,0.22)] transition-[width] hover:w-11 hover:bg-brand-surface-raised"
      >
        <i className="ri-capsule-line text-xl" aria-hidden="true" />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Medication shelf">
        <div className="space-y-5">
          <div className="rounded-2xl border border-brand-line bg-brand-ink/[0.04] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent1/15 text-brand-accent1">
                <i className="ri-alarm-warning-line text-xl" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-brand-ink">Device alarm status</p>
                  <Badge tone={deviceAlarmStatus.tone}>
                    {deviceAlarmStatus.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-brand-ink/60">
                  {deviceAlarmStatus.body} Follow your prescription label and clinician instructions.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-brand-line bg-brand-surface px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink/45">Open app</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">Tone and banner</p>
                  </div>
                  <div className="rounded-xl border border-brand-line bg-brand-surface px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink/45">Closed app</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">{deviceAlarmStatus.closedApp}</p>
                  </div>
                  <div className="rounded-xl border border-brand-line bg-brand-surface px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink/45">Alarm style</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">Persistent buzz</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {pushStatus === 'unsupported' ? (
                    <Badge tone="neutral">Not supported on this browser</Badge>
                  ) : pushStatus === 'denied' ? (
                    <Badge tone="warning">Notifications blocked</Badge>
                  ) : pushStatus === 'server-unconfigured' ? (
                    <Button size="sm" variant="secondary" onClick={handleEnablePush} disabled={pushBusy} isLoading={pushBusy}>
                      Try again
                    </Button>
                  ) : pushStatus === 'granted-subscribed' ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={handleTestPush} disabled={testingPush} isLoading={testingPush}>
                        Send push test
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleDisablePush} disabled={pushBusy}>
                        Turn off
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleEnablePush}
                      disabled={pushBusy}
                      isLoading={pushBusy}
                      leadingIcon={!pushBusy ? <i className="ri-notification-badge-line" aria-hidden="true" /> : undefined}
                    >
                      {pushStatus === 'granted-refresh-needed' ? 'Refresh device alarms' : 'Turn on device alarms'}
                    </Button>
                  )}
                  {permission !== 'unsupported' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleTestLocalAlarm}
                      disabled={testingLocalAlarm}
                      isLoading={testingLocalAlarm}
                    >
                      Test alarm now
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-3 rounded-2xl border border-brand-line bg-brand-surface p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleIdentifyFile}
            />

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent4/15 text-brand-accent4">
                <i className="ri-camera-lens-line text-xl" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink">Identify a med from a photo</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-ink/60">
                  Take or upload a clear photo of the pill, label, or box. AI reads it and explains the facts.
                  General information only. Not medical advice.
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openIdentifyPicker}
                    disabled={identifying}
                    isLoading={identifying}
                    leadingIcon={!identifying ? <i className="ri-camera-line" aria-hidden="true" /> : undefined}
                  >
                    {identifying ? 'Reading the photo...' : 'Take or upload a photo'}
                  </Button>
                </div>
              </div>
            </div>

            {identifying && (
              <div className="flex items-center gap-2 rounded-xl bg-brand-ink/[0.04] p-3 text-xs text-brand-ink/65">
                <Spinner className="h-4 w-4" />
                Looking at your photo and gathering the facts...
              </div>
            )}

            {identifyError && (
              <Alert tone="error" title="Could not identify it">
                {identifyError} Please try a sharper, well-lit photo of the label or the imprint.
              </Alert>
            )}

            {identifiedMed && (
              <article className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-brand-ink">{identifiedMed.name}</p>
                    <p className="mt-0.5 text-xs text-brand-ink/55">
                      {identifiedMed.generic_name ? `Generic: ${identifiedMed.generic_name}` : null}
                      {identifiedMed.generic_name && identifiedMed.drug_class ? ' · ' : null}
                      {identifiedMed.drug_class ? `Class: ${identifiedMed.drug_class}` : null}
                    </p>
                    <Badge className="mt-2" tone={confidenceTones[identifiedMed.confidence]}>
                      {confidenceLabels[identifiedMed.confidence]}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={dismissIdentification}
                    aria-label="Dismiss result"
                    className="rounded-full p-2 text-brand-ink/55 transition hover:bg-brand-ink/10 hover:text-brand-ink"
                  >
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                </div>

                {identifiedMed.used_for.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-ink/50">What it&apos;s for</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-brand-ink/80">
                      {identifiedMed.used_for.map((item) => (
                        <li key={item} className="flex gap-2">
                          <i className="ri-checkbox-circle-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {identifiedMed.common_benefits.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-ink/50">Common benefits</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {identifiedMed.common_benefits.map((item) => (
                        <Badge key={item} tone="sage">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {identifiedMed.common_side_effects.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-ink/50">Common side effects</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {identifiedMed.common_side_effects.map((item) => (
                        <Badge key={item} tone="gold">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {identifiedMed.serious_warnings.length > 0 && (
                  <Alert tone="error" title="Serious warnings">
                    <ul className="mt-1 space-y-1">
                      {identifiedMed.serious_warnings.map((item) => (
                        <li key={item} className="flex gap-2">
                          <i className="ri-alert-line mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {identifiedMed.interactions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-ink/50">Interactions to watch</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-brand-ink/80">
                      {identifiedMed.interactions.map((item) => (
                        <li key={item} className="flex gap-2">
                          <i className="ri-error-warning-line mt-0.5 text-brand-accent2" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {identifiedMed.ask_your_doctor.length > 0 && (
                  <div className="rounded-xl bg-brand-accent5/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-accent5">Ask your doctor or pharmacist</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-brand-ink/80">
                      {identifiedMed.ask_your_doctor.map((item) => (
                        <li key={item} className="flex gap-2">
                          <i className="ri-stethoscope-line mt-0.5 text-brand-accent5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {identifiedFacts && (
                  <div className="space-y-3 rounded-2xl border border-brand-accent3/30 bg-brand-accent3/[0.06] p-3">
                    <div className="flex items-center gap-2">
                      <i className="ri-verified-badge-line text-brand-accent3" aria-hidden="true" />
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-accent3">Verified facts</p>
                    </div>
                    {identifiedFacts.matched_name && (
                      <p className="text-xs text-brand-ink/60">
                        Matched to{' '}
                        <span className="font-semibold text-brand-ink/80">{identifiedFacts.matched_name}</span> in the
                        NIH RxNorm database.
                      </p>
                    )}
                    {identifiedFacts.boxed_warning && (
                      <Alert tone="error" title="FDA boxed warning">
                        {identifiedFacts.boxed_warning}
                      </Alert>
                    )}
                    {identifiedFacts.patient_reported_reactions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-brand-ink/70">Most reported by patients (FDA FAERS)</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {identifiedFacts.patient_reported_reactions.map((reaction) => (
                            <Badge key={reaction.term} tone="neutral">
                              {reaction.term} · {reaction.count.toLocaleString()}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-brand-ink/45">
                          Patient-reported to the FDA. Unverified and not proof of cause.
                        </p>
                      </div>
                    )}
                    {identifiedFacts.medlineplus_url && (
                      <a
                        href={identifiedFacts.medlineplus_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-accent2 hover:underline"
                      >
                        <i className="ri-external-link-line" aria-hidden="true" /> Read plain-language info on MedlinePlus
                      </a>
                    )}
                    {identifiedFacts.sources.length > 0 && (
                      <p className="text-[11px] text-brand-ink/45">
                        Sources: {identifiedFacts.sources.map((source) => source.title).join(' · ')}
                      </p>
                    )}
                  </div>
                )}

                <p className="rounded-xl border border-brand-line-strong bg-brand-ink/[0.03] p-3 text-xs leading-relaxed text-brand-ink/70">
                  <i className="ri-information-line mr-1" aria-hidden="true" />
                  {identifiedMed.disclaimer}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => addIdentifiedToReminders(identifiedMed)}
                    leadingIcon={<i className="ri-alarm-line" aria-hidden="true" />}
                  >
                    Add to my reminders
                  </Button>
                  <Button size="sm" variant="secondary" onClick={openIdentifyPicker} disabled={identifying}>
                    Try another photo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismissIdentification}>
                    Dismiss
                  </Button>
                </div>
              </article>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-ink">Your shelf</h3>
              <Button size="sm" variant="ghost" onClick={loadReminders} disabled={loadingReminders}>
                Refresh
              </Button>
            </div>

            {loadingReminders ? (
              <div className="rounded-2xl border border-brand-line bg-brand-ink/[0.03] p-4 text-sm text-brand-ink/60">
                Loading reminders...
              </div>
            ) : sortedReminders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-line-strong p-5 text-center">
                <i className="ri-capsule-line text-2xl text-brand-accent1" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-brand-ink">No medications saved yet</p>
                <p className="mt-1 text-xs text-brand-ink/55">Add one below and choose the daily reminder times.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReminders.map((reminder) => {
                  const adh = adherence[reminder.id]
                  return (
                  <article key={reminder.id} className="rounded-2xl border border-brand-line bg-brand-surface-raised p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-ink">{reminder.medication}</p>
                        <p className="mt-1 text-xs text-brand-ink/55">
                          {reminder.dose ? `${reminder.dose} · ` : ''}
                          {formatTimes(reminder.times)}
                        </p>
                        {!reminder.active ? (
                          <Badge className="mt-2" tone="neutral">
                            Paused
                          </Badge>
                        ) : isTakenToday(reminder.last_taken_at) ? (
                          <Badge className="mt-2" tone="success">
                            <i className="ri-check-line" aria-hidden="true" /> Taken today
                          </Badge>
                        ) : (
                          <Badge className="mt-2" tone="warning">
                            <i className="ri-time-line" aria-hidden="true" /> Not taken yet
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => editReminder(reminder)}
                        aria-label={`Edit ${reminder.medication}`}
                        className="rounded-full p-2 text-brand-ink/55 transition hover:bg-brand-ink/10 hover:text-brand-ink"
                      >
                        <i className="ri-pencil-line" aria-hidden="true" />
                      </button>
                    </div>
                    {adh && adh.expected_days > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-brand-ink/55">
                          <span>Last {adh.recent.length} days</span>
                          <span className="font-semibold text-brand-ink/70">
                            {adh.taken_days}/{adh.expected_days} days · {adh.adherence_pct}%
                          </span>
                        </div>
                        <div
                          className="mt-1.5 flex flex-wrap gap-1"
                          aria-label={`Taken ${adh.taken_days} of ${adh.expected_days} days, ${adh.adherence_pct} percent`}
                        >
                          {adh.recent.map((cell, index) => (
                            <span
                              key={index}
                              title={cell === null ? 'Before this reminder' : cell ? 'Taken' : 'Missed'}
                              className={`h-2 w-2 rounded-full ${
                                cell === null
                                  ? 'bg-brand-ink/10'
                                  : cell
                                    ? 'bg-brand-accent3'
                                    : 'bg-brand-accent1/40'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isTakenToday(reminder.last_taken_at) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markTaken(reminder)}
                          leadingIcon={<i className="ri-checkbox-circle-fill text-brand-accent3" aria-hidden="true" />}
                        >
                          Taken
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => markTaken(reminder)}
                          leadingIcon={<i className="ri-check-line" aria-hidden="true" />}
                        >
                          Mark taken
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteReminder(reminder.id)}>
                        Delete
                      </Button>
                    </div>
                  </article>
                  )
                })}
              </div>
            )}
          </section>

          <section
            ref={addFormRef}
            className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface p-4 scroll-mt-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-brand-ink">{form.id ? 'Edit reminder' : 'Add medication'}</h3>
              {form.id && (
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancel edit
                </Button>
              )}
            </div>

            <Field label="Medication name" htmlFor="medication-shelf-name">
              <Input
                id="medication-shelf-name"
                value={form.medication}
                onChange={(event) => setForm((current) => ({ ...current, medication: event.target.value }))}
                placeholder="Example: Metformin"
              />
            </Field>

            <Field label="Dose" htmlFor="medication-shelf-dose" hint="Optional. Use what the label says.">
              <Input
                id="medication-shelf-dose"
                value={form.dose}
                onChange={(event) => setForm((current) => ({ ...current, dose: event.target.value }))}
                placeholder="Example: 500 mg"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="How often" htmlFor="medication-shelf-frequency">
                <Select
                  id="medication-shelf-frequency"
                  value={form.frequency}
                  onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}
                >
                  <SelectOption value="once daily">Once daily</SelectOption>
                  <SelectOption value="twice daily">Twice daily</SelectOption>
                  <SelectOption value="three times daily">Three times daily</SelectOption>
                  <SelectOption value="custom">Custom</SelectOption>
                </Select>
              </Field>
              <Field label="Timing notes" htmlFor="medication-shelf-timing">
                <Input
                  id="medication-shelf-timing"
                  value={form.timingHint}
                  onChange={(event) => setForm((current) => ({ ...current, timingHint: event.target.value }))}
                  placeholder="With food, bedtime..."
                />
              </Field>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={suggestTimes}
              disabled={suggesting}
              isLoading={suggesting}
              leadingIcon={!suggesting ? <i className="ri-sparkling-line" aria-hidden="true" /> : undefined}
            >
              Ask AI for times
            </Button>

            {suggestionNote && (
              <p className="rounded-xl bg-brand-accent2/10 p-3 text-xs leading-relaxed text-brand-ink/70">
                {suggestionNote}
              </p>
            )}

            <Field label="Reminder times" htmlFor="medication-shelf-time">
              <div className="flex gap-2">
                <Input
                  id="medication-shelf-time"
                  ref={timeInputRef}
                  type="time"
                  value={timeInput}
                  onChange={(event) => setTimeInput(event.target.value)}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addTime} aria-label="Add time">
                  <i className="ri-add-line" aria-hidden="true" />
                </Button>
              </div>
              {form.times.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizeReminderTimes(form.times).map((time) => (
                    <Badge key={time} tone="accent" className="gap-1">
                      {time}
                      <button
                        type="button"
                        onClick={() => removeTime(time)}
                        aria-label={`Remove ${time}`}
                        className="rounded-full text-current/70 hover:text-current"
                      >
                        <i className="ri-close-line text-xs" aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </Field>

            <SwitchRow
              checked={form.active}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
              title="Reminder is active"
              description="Pause it without deleting this medication."
            />

            <Button fullWidth onClick={saveReminder} disabled={saving} isLoading={saving}>
              {form.id ? 'Update reminder' : 'Save reminder'}
            </Button>
          </section>
        </div>
      </Drawer>
    </>
  )
}
