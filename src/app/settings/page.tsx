'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import InstallAppButton from '@/components/InstallAppButton'
import PlatformAvatarPicker from '@/components/PlatformAvatarPicker'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useTheme } from '@/components/ThemeProvider'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { EncryptionService } from '@/lib/encryption'
import { invalidateCachedProfile } from '@/lib/profile-cache'
import { resolveAvatarUrl } from '@/lib/profile-avatars'
import { StorageService } from '@/lib/storage'
import { isSfxEnabled, setSfxEnabled, playSfx } from '@/lib/audio/sfx'
import { Button, Card, Input, Textarea, Field, Badge, Skeleton } from '@/components/ui'
import { exportMyDataAction, deleteAccountAction } from '@/app/actions/account'

interface ProfileData {
  full_name: string
  username: string
  bio: string
  location: string
  age: string
  pronouns: string
  conditions: string[]
  comorbidities: string[]
  medications: string[]
  status: string
  is_anonymous: boolean
  anonymous_profile_visibility: string
  share_health_with_guide: boolean
  preferred_communication: string
  notify_matches: boolean
  notify_messages: boolean
  notify_groups: boolean
  notify_research: boolean
  hide_conditions_on_profile: boolean
  avatar_url?: string | null
  [key: string]: unknown
}

const defaultProfile: ProfileData = {
  full_name: '',
  username: '',
  bio: '',
  location: '',
  age: '',
  pronouns: '',
  conditions: [],
  comorbidities: [],
  medications: [],
  status: '',
  is_anonymous: false,
  anonymous_profile_visibility: 'connections',
  share_health_with_guide: true,
  preferred_communication: 'chat',
  notify_matches: true,
  notify_messages: true,
  notify_groups: true,
  notify_research: true,
  hide_conditions_on_profile: false,
}

const pronounOptions = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Prefer not to say']
const communicationOptions = [
  { value: 'chat', label: 'Chat', icon: 'ri-chat-1-line' },
  { value: 'voice', label: 'Voice', icon: 'ri-mic-line' },
  { value: 'video', label: 'Video', icon: 'ri-vidicon-line' },
]

const themeOptions = [
  { value: 'light', label: 'Light', icon: 'ri-sun-line', detail: 'Bright, warm surfaces' },
  { value: 'dark', label: 'Dark', icon: 'ri-moon-line', detail: 'Lower glare for night use' },
] as const

const motionOptions = [
  { value: 'reduced', label: 'Reduced', icon: 'ri-leaf-line', detail: 'Less motion and fewer animated shifts' },
  { value: 'full', label: 'Full', icon: 'ri-sparkling-line', detail: 'Standard transitions and movement' },
] as const

type BlockedRow = { user_id: string; profile: { username?: string; full_name?: string | null } | null }

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { theme, setTheme, motion, setMotion } = useTheme()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData>(defaultProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [conditionInput, setConditionInput] = useState('')
  const [comorbidityInput, setComorbidityInput] = useState('')
  const [medicationInput, setMedicationInput] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedRow[]>([])
  const [exportingData, setExportingData] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  // Sound preference is device-local (localStorage), saved instantly rather than via the profile save.
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    setSoundOn(isSfxEnabled())
  }, [])

  const handleToggleSound = () => {
    const next = !soundOn
    setSfxEnabled(next)
    setSoundOn(next)
    if (next) playSfx('toggle')
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    DatabaseService.getBlockedUsers()
      .then((rows) => {
        if (!cancelled) setBlockedUsers((Array.isArray(rows) ? rows : []) as BlockedRow[])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])

  const handleUnblock = async (id: string) => {
    try {
      await DatabaseService.unblockUser(id)
      setBlockedUsers((prev) => prev.filter((b) => b.user_id !== id))
    } catch {
      // best effort
    }
  }
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const validation = StorageService.validateFile(file, 5)
    if (!validation.valid) {
      showToast('error', validation.error || 'Invalid file')
      return
    }
    setUploadingAvatar(true)
    try {
      const url = await StorageService.uploadProfileAvatar(user.userId, file)
      setProfile((prev) => ({ ...prev, avatar_url: url }))
      await DatabaseService.updateProfile(user.userId, { avatar_url: url })
      invalidateCachedProfile(user.userId)
      showToast('success', 'Avatar updated!')
    } catch (err) {
      console.error('Avatar upload failed:', err)
      showToast('error', 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handlePlatformAvatarSelect = async (avatarUrl: string) => {
    if (!user) return

    setUploadingAvatar(true)
    try {
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }))
      await DatabaseService.updateProfile(user.userId, { avatar_url: avatarUrl })
      invalidateCachedProfile(user.userId)
      showToast('success', 'Profile photo updated!')
    } catch (err) {
      console.error('Platform avatar update failed:', err)
      showToast('error', 'Failed to update profile photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return
      try {
        const data = await DatabaseService.getProfile(user.userId) as Record<string, unknown> | null
        if (data) {
          // Decrypt health fields if encrypted
          let healthFields = {
            conditions: (data.conditions as string[]) || [],
            comorbidities: (data.comorbidities as string[]) || [],
            medications: (data.medications as string[]) || [],
            status: (data.status as string) || '',
          }
          try {
            const key = await EncryptionService.getOrCreateUserKey(user.userId)
            const decrypted = await EncryptionService.decryptFields(data, key)
            healthFields = {
              conditions: decrypted.conditions,
              comorbidities: decrypted.comorbidities,
              medications: decrypted.medications,
              status: decrypted.status || '',
            }
          } catch (decryptErr) {
            console.error('Failed to decrypt health data:', decryptErr)
          }

          setProfile({
            ...defaultProfile,
            ...data,
            ...healthFields,
            // Coalesce nullable DB columns so controlled inputs never receive null.
            full_name: (data.full_name as string | null) ?? '',
            username: (data.username as string | null) ?? '',
            bio: (data.bio as string | null) ?? '',
            location: (data.location as string | null) ?? '',
            pronouns: (data.pronouns as string | null) ?? '',
            status: (data.status as string | null) ?? '',
            age: data.age ? String(data.age) : '',
            notify_matches: data.notify_matches !== false,
            notify_messages: data.notify_messages !== false,
            notify_groups: data.notify_groups !== false,
            notify_research: data.notify_research !== false,
            share_health_with_guide: data.share_health_with_guide !== false,
            anonymous_profile_visibility: (data.anonymous_profile_visibility as string) || 'connections',
            hide_conditions_on_profile: data.hide_conditions_on_profile === true,
          } as ProfileData)
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    if (user) fetchProfile()
  }, [user])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Check username uniqueness
      if (profile.username.trim()) {
        const taken = await DatabaseService.isUsernameTaken(profile.username, user.userId)
        if (taken) {
          setUsernameError('This username is already taken')
          setSaving(false)
          return
        }
        setUsernameError(null)
      }

      // Encrypt sensitive health data before saving
      const key = await EncryptionService.getOrCreateUserKey(user.userId)
      const encryptedFields = await EncryptionService.encryptFields(
        {
          conditions: profile.conditions,
          comorbidities: profile.comorbidities,
          medications: profile.medications,
          status: profile.status || null,
        },
        key,
      )

      const updates = {
        full_name: profile.full_name,
        username: profile.username,
        bio: profile.bio,
        location: profile.location,
        age: profile.age ? parseInt(profile.age, 10) : null,
        pronouns: profile.pronouns,
        is_anonymous: profile.is_anonymous,
        anonymous_profile_visibility: profile.anonymous_profile_visibility,
        share_health_with_guide: profile.share_health_with_guide,
        preferred_communication: profile.preferred_communication,
        notify_matches: profile.notify_matches,
        notify_messages: profile.notify_messages,
        notify_groups: profile.notify_groups,
        notify_research: profile.notify_research,
        hide_conditions_on_profile: profile.hide_conditions_on_profile,
        // Store encrypted health data (plaintext fields zeroed out by encryptFields)
        ...encryptedFields,
      }
      await DatabaseService.updateProfile(user.userId, updates)
      invalidateCachedProfile(user.userId)
      showToast('success', 'Profile updated successfully!')
    } catch (err) {
      console.error('Failed to save profile:', err)
      showToast('error', 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = (
    field: 'conditions' | 'comorbidities' | 'medications',
    value: string,
    setter: (v: string) => void
  ) => {
    const trimmed = value.trim()
    if (!trimmed || profile[field].includes(trimmed)) return
    setProfile((prev) => ({ ...prev, [field]: [...prev[field], trimmed] }))
    setter('')
  }

  const handleRemoveTag = (
    field: 'conditions' | 'comorbidities' | 'medications',
    index: number
  ) => {
    setProfile((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const handleExportData = async () => {
    setExportingData(true)
    try {
      const result = await exportMyDataAction()
      if (!result.ok) {
        showToast('error', result.error)
        return
      }
      const blob = new Blob([result.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kinspace-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast('success', 'Your data export is ready')
    } catch {
      showToast('error', 'Could not export your data right now')
    } finally {
      setExportingData(false)
    }
  }

  const handleDeleteAccount = async () => {
    const email = user?.email ?? ''
    if (!email) {
      showToast('error', 'Your account email could not be confirmed')
      return
    }
    if (deleteConfirmation.trim().toLowerCase() !== email.toLowerCase()) {
      showToast('error', 'Type your account email to confirm deletion')
      return
    }

    setDeletingAccount(true)
    try {
      const result = await deleteAccountAction(deleteConfirmation)
      if (!result.ok) {
        showToast('error', result.error)
        return
      }
      router.replace(result.redirect)
    } catch {
      showToast('error', 'Could not delete your account right now')
    } finally {
      setDeletingAccount(false)
    }
  }

  const currentAvatarUrl = resolveAvatarUrl({
    avatar_url: profile.avatar_url,
    full_name: profile.full_name,
    userId: user?.userId,
    username: profile.username,
  })
  const accountEmail = user?.email ?? ''

  if (authLoading || loading) {
    return (
      <main className="page-shell min-h-screen">
        <div className="page-container max-w-3xl space-y-6 pt-14">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-20 rounded-2xl" />
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="page-shell min-h-screen">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl p-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-brand-accent3/90 text-brand-background'
              : 'bg-brand-accent1/90 text-white'
          }`}
        >
          <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="page-container max-w-3xl pb-4 pt-14">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-background/5 text-brand-background transition-colors hover:bg-brand-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
            >
              <i className="ri-arrow-left-line text-lg" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-brand-background">Settings</h1>
              <p className="text-sm text-brand-background/55">Manage your profile, privacy, and notifications.</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
            size="sm"
            leadingIcon={!saving ? <i className="ri-check-line" /> : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="page-container max-w-3xl space-y-6">
        {/* Profile Section */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-user-line text-brand-accent2" /> Profile
          </h2>
          <div className="space-y-4">
            {/* Avatar Upload Placeholder */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <ProfileAvatar
                  alt="Avatar"
                  avatarUrl={profile.avatar_url}
                  className="h-16 w-16 rounded-full border-2 border-brand-accent2 object-cover"
                  fullName={profile.full_name}
                  userId={user?.userId}
                  username={profile.username}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent1 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60"
                >
                  {uploadingAvatar ? (
                    <i className="ri-loader-4-line animate-spin text-xs" />
                  ) : (
                    <i className="ri-camera-line text-xs" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-brand-background">Profile photo</p>
                <p className="text-xs text-brand-background/45">
                  Upload your own or choose a KinSpace icon.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  leadingIcon={<i className="ri-upload-2-line" />}
                >
                  Upload from device
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-brand-background/55">KinSpace icons</p>
              <PlatformAvatarPicker
                disabled={uploadingAvatar}
                onSelect={handlePlatformAvatarSelect}
                selectedAvatarUrl={currentAvatarUrl}
              />
            </div>

            {/* Full Name */}
            <Field label="Full name" htmlFor="settings-full-name">
              <Input
                id="settings-full-name"
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your full name"
              />
            </Field>

            {/* Username */}
            <Field label="Username" htmlFor="settings-username" error={usernameError}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-background/40">@</span>
                <Input
                  id="settings-username"
                  type="text"
                  value={profile.username}
                  aria-invalid={usernameError ? true : undefined}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
                    setProfile((p) => ({ ...p, username: val }))
                    setUsernameError(null)
                    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current)
                    if (val.trim() && user) {
                      usernameCheckTimer.current = setTimeout(async () => {
                        const taken = await DatabaseService.isUsernameTaken(val, user.userId)
                        if (taken) setUsernameError('This username is already taken')
                      }, 600)
                    }
                  }}
                  placeholder="username"
                  className="!pl-8"
                />
              </div>
            </Field>

            {/* Bio */}
            <Field label="Bio" htmlFor="settings-bio">
              <Textarea
                id="settings-bio"
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell the community a little about yourself…"
                rows={3}
                className="resize-none"
              />
            </Field>

            {/* Location */}
            <Field label="Location" htmlFor="settings-location">
              <div className="relative">
                <i className="ri-map-pin-2-line absolute left-3 top-1/2 -translate-y-1/2 text-brand-background/40" />
                <Input
                  id="settings-location"
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  placeholder="City, State"
                  className="!pl-9"
                />
              </div>
            </Field>

            {/* Age & Pronouns Row */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" htmlFor="settings-age">
                <Input
                  id="settings-age"
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                  placeholder="Age"
                  min="13"
                  max="120"
                />
              </Field>
              <Field label="Pronouns" htmlFor="settings-pronouns">
                <select
                  id="settings-pronouns"
                  value={profile.pronouns}
                  onChange={(e) => setProfile((p) => ({ ...p, pronouns: e.target.value }))}
                  className="w-full rounded-xl border border-brand-background/15 bg-brand-background/[0.08] px-4 py-3 text-sm text-brand-background transition-colors focus:border-brand-background/40 focus:outline-none focus:ring-2 focus:ring-brand-background/10"
                >
                  <option value="">Select…</option>
                  {pronounOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Card>

        {/* Access and comfort */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-universal-access-line text-brand-accent5" /> Access and comfort
          </h2>
          <p className="mb-4 text-sm text-brand-background/55">
            Tune KinSpace for glare, motion, and sensory load. These choices save on this device.
          </p>

          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-brand-background/90">Color mode</legend>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map((option) => {
                  const selected = theme === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTheme(option.value)}
                      className={`min-h-[5rem] rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                        selected
                          ? 'border-brand-accent2/45 bg-brand-accent2/15 text-brand-accent2'
                          : 'border-brand-background/10 bg-brand-background/5 text-brand-background/65 hover:bg-brand-background/10'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <i className={option.icon} aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs opacity-70">{option.detail}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-brand-background/90">Motion level</legend>
              <div className="grid grid-cols-2 gap-2">
                {motionOptions.map((option) => {
                  const selected = motion === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setMotion(option.value)}
                      className={`min-h-[5rem] rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                        selected
                          ? 'border-brand-accent3/45 bg-brand-accent3/15 text-brand-accent3'
                          : 'border-brand-background/10 bg-brand-background/5 text-brand-background/65 hover:bg-brand-background/10'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <i className={option.icon} aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs opacity-70">{option.detail}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent3/15">
                  <i className="ri-volume-up-line text-brand-accent3" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Sound effects</p>
                  <p className="text-xs text-brand-background/45">
                    Gentle taps, game sounds, and reminder chimes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-label="Sound effects"
                onClick={handleToggleSound}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  soundOn ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  soundOn ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* Health Info Section */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-heart-pulse-line text-brand-accent1" /> Health info
          </h2>
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-accent3/10 p-2.5">
            <i className="ri-shield-keyhole-line mt-0.5 text-sm text-brand-accent3" />
            <p className="text-xs text-brand-background/65">
              This is <strong className="text-brand-accent3">end-to-end encrypted</strong>. Only you can see it. None of it is medical advice.
            </p>
          </div>
          <div className="space-y-4">
            {/* Conditions */}
            <Field label="Conditions" htmlFor="settings-condition-input">
              {profile.conditions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {profile.conditions.map((c, i) => (
                    <Badge key={c} tone="accent" className="gap-1">
                      {c}
                      <button onClick={() => handleRemoveTag('conditions', i)} aria-label={`Remove ${c}`} className="transition-colors hover:text-white">
                        <i className="ri-close-line text-xs" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="settings-condition-input"
                  type="text"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('conditions', conditionInput, setConditionInput)
                    }
                  }}
                  placeholder="Add a condition…"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Add condition"
                  onClick={() => handleAddTag('conditions', conditionInput, setConditionInput)}
                >
                  <i className="ri-add-line" />
                </Button>
              </div>
            </Field>

            {/* Comorbidities */}
            <Field label="Comorbidities" htmlFor="settings-comorbidity-input">
              {profile.comorbidities.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {profile.comorbidities.map((c, i) => (
                    <Badge key={c} className="gap-1 bg-brand-accent2/20 text-brand-background">
                      {c}
                      <button onClick={() => handleRemoveTag('comorbidities', i)} aria-label={`Remove ${c}`} className="transition-colors hover:text-white">
                        <i className="ri-close-line text-xs" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="settings-comorbidity-input"
                  type="text"
                  value={comorbidityInput}
                  onChange={(e) => setComorbidityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('comorbidities', comorbidityInput, setComorbidityInput)
                    }
                  }}
                  placeholder="Add a comorbidity…"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Add comorbidity"
                  onClick={() => handleAddTag('comorbidities', comorbidityInput, setComorbidityInput)}
                >
                  <i className="ri-add-line" />
                </Button>
              </div>
            </Field>

            {/* Medications */}
            <Field label="Medications" htmlFor="settings-medication-input">
              {profile.medications.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {profile.medications.map((m, i) => (
                    <Badge key={m} className="gap-1 bg-brand-accent3/20 text-brand-background">
                      {m}
                      <button onClick={() => handleRemoveTag('medications', i)} aria-label={`Remove ${m}`} className="transition-colors hover:text-white">
                        <i className="ri-close-line text-xs" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="settings-medication-input"
                  type="text"
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('medications', medicationInput, setMedicationInput)
                    }
                  }}
                  placeholder="Add a medication…"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Add medication"
                  onClick={() => handleAddTag('medications', medicationInput, setMedicationInput)}
                >
                  <i className="ri-add-line" />
                </Button>
              </div>
            </Field>

            {/* Status */}
            <Field label="Where you are right now" htmlFor="settings-status">
              <Input
                id="settings-status"
                type="text"
                value={profile.status}
                onChange={(e) => setProfile((p) => ({ ...p, status: e.target.value }))}
                placeholder="e.g. In treatment, Managing, In recovery…"
              />
            </Field>

            {/* Hide conditions on profile */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-accent3/15">
                  <i className="ri-eye-off-line text-brand-accent3" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Hide conditions on my profile</p>
                  <p className="text-xs text-brand-background/45">
                    Keep your conditions off your profile page. Other people never see them anyway, this hides them from your own profile view too.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile.hide_conditions_on_profile}
                aria-label="Hide conditions on my profile"
                onClick={() => setProfile((p) => ({ ...p, hide_conditions_on_profile: !p.hide_conditions_on_profile }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.hide_conditions_on_profile ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.hide_conditions_on_profile ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* Privacy Section */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-shield-check-line text-brand-accent3" /> Privacy
          </h2>
          <div className="space-y-4">
            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-background/10">
                  <i className="ri-spy-line text-brand-background/70" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Anonymous mode</p>
                  <p className="text-xs text-brand-background/45">Hide your identity in posts</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.is_anonymous}
                aria-label="Anonymous mode"
                onClick={() => setProfile((p) => ({ ...p, is_anonymous: !p.is_anonymous }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.is_anonymous ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.is_anonymous ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Who can view the profile while anonymous */}
            {profile.is_anonymous && (
              <div className="rounded-xl bg-brand-background/[0.06] p-3">
                <p className="text-sm font-medium text-brand-background">Who can view your profile</p>
                <p className="mt-0.5 text-xs text-brand-background/45">
                  While anonymous, your profile page is hidden. Your posts and comments stay visible either way.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { value: 'connections', label: 'My connections', icon: 'ri-links-line' },
                    { value: 'private', label: 'No one', icon: 'ri-lock-2-line' },
                  ].map((opt) => {
                    const selected = profile.anonymous_profile_visibility === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setProfile((p) => ({ ...p, anonymous_profile_visibility: opt.value }))}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                          selected
                            ? 'border-brand-accent2/40 bg-brand-accent2/15 text-brand-accent2'
                            : 'border-brand-background/10 bg-brand-background/5 text-brand-background/60 hover:bg-brand-background/10'
                        }`}
                      >
                        <i className={opt.icon} aria-hidden="true" /> {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Share health profile with the Guide */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent3/15">
                  <i className="ri-mental-health-line text-brand-accent3" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Let your Guide know your health</p>
                  <p className="text-xs text-brand-background/45">
                    Share your conditions and medications with the therapy Guide so it can support you with full
                    context. Turn off to keep them private.
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.share_health_with_guide}
                aria-label="Share health profile with the Guide"
                onClick={() => setProfile((p) => ({ ...p, share_health_with_guide: !p.share_health_with_guide }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.share_health_with_guide ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.share_health_with_guide ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Communication Preferences */}
            <div>
              <p className="mb-2 text-sm font-medium text-brand-background/90">How you prefer to connect</p>
              <div className="grid grid-cols-3 gap-2">
                {communicationOptions.map((opt) => {
                  const isSelected = profile.preferred_communication === opt.value
                  return (
                    <button
                      key={opt.value}
                      aria-pressed={isSelected}
                      onClick={() => setProfile((p) => ({ ...p, preferred_communication: opt.value }))}
                      className={`flex h-auto min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                        isSelected
                          ? 'border-brand-accent2/40 bg-brand-accent2/15 text-brand-accent2'
                          : 'border-brand-background/10 bg-brand-background/5 text-brand-background/55 hover:bg-brand-background/10'
                      }`}
                    >
                      <i className={`${opt.icon} text-lg`} />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Notifications Section */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-notification-3-line text-brand-accent2" /> Notifications
          </h2>
          <div className="space-y-3">
            {/* Matches Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent1/15">
                  <i className="ri-hearts-line text-brand-accent1" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Matches</p>
                  <p className="text-xs text-brand-background/45">When someone could be a good match</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.notify_matches}
                aria-label="Match notifications"
                onClick={() => setProfile((p) => ({ ...p, notify_matches: !p.notify_matches }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.notify_matches ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.notify_matches ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Messages Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent2/15">
                  <i className="ri-chat-1-line text-brand-accent2" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Messages</p>
                  <p className="text-xs text-brand-background/45">New message alerts</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.notify_messages}
                aria-label="Message notifications"
                onClick={() => setProfile((p) => ({ ...p, notify_messages: !p.notify_messages }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.notify_messages ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.notify_messages ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Groups Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent3/15">
                  <i className="ri-group-line text-brand-accent3" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Groups</p>
                  <p className="text-xs text-brand-background/45">Group activity updates</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.notify_groups}
                aria-label="Group notifications"
                onClick={() => setProfile((p) => ({ ...p, notify_groups: !p.notify_groups }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.notify_groups ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.notify_groups ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Research Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent4/15">
                  <i className="ri-article-line text-brand-accent4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-background">Research emails</p>
                  <p className="text-xs text-brand-background/45">New articles that match your profile conditions</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={profile.notify_research}
                aria-label="Research email alerts"
                onClick={() => setProfile((p) => ({ ...p, notify_research: !p.notify_research }))}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 ${
                  profile.notify_research ? 'bg-brand-accent2' : 'bg-brand-background/20'
                }`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  profile.notify_research ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* Install app */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-smartphone-line text-brand-accent1" /> Install the app
          </h2>
          <p className="mb-4 text-sm text-brand-background/55">
            Add KinSpace to your home screen for one-tap access, reminders, and offline support — no app store needed.
          </p>
          <InstallAppButton label="Install KinSpace" />
          <p className="mt-3 text-xs text-brand-background/40">
            Don&rsquo;t see the button? Open kinspace.co.za in your phone&rsquo;s browser, then tap it (or use your browser&rsquo;s &ldquo;Add to Home Screen&rdquo;).
          </p>
        </Card>

        {/* Blocked accounts */}
        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-forbid-2-line text-brand-accent1" /> Blocked accounts
          </h2>
          <p className="mb-4 text-xs text-brand-background/45">
            People you&rsquo;ve blocked can&rsquo;t message you, and you won&rsquo;t see their posts.
          </p>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-brand-background/50">You haven&rsquo;t blocked anyone.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((b) => (
                <div
                  key={b.user_id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.06] p-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-brand-background">
                    <i className="ri-user-3-line text-brand-background/40" aria-hidden="true" />
                    <span className="truncate">@{b.profile?.username ?? 'member'}</span>
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => handleUnblock(b.user_id)}>
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Privacy vault */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-brand-background">
            <i className="ri-shield-keyhole-line text-brand-accent2" /> Privacy vault
          </h2>
          <p className="mb-4 text-sm text-brand-background/55">
            Control your health data, ad measurement, and account removal from one place.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-brand-background/[0.06] p-3">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent2/15">
                <i className="ri-file-download-line text-brand-accent2" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-brand-background">Data export</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-background/50">
                Download your account, profile, posts, logs, reminders, saves, and group records.
              </p>
            </div>
            <div className="rounded-xl bg-brand-background/[0.06] p-3">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent3/15">
                <i className="ri-advertisement-line text-brand-accent3" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-brand-background">Ad boundary</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-background/50">
                Meta Pixel tracks PageView only. Profile fields and messages stay out of ad events.
              </p>
            </div>
            <div className="rounded-xl bg-brand-background/[0.06] p-3">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent1/15">
                <i className="ri-delete-bin-6-line text-brand-accent1" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-brand-background">Removal</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-background/50">
                Delete your account and personal records after typing your account email.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-background/10 bg-brand-background/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-background">Download a copy</p>
              <p className="text-xs text-brand-background/45">Creates a JSON file on this device.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportData}
              isLoading={exportingData}
              leadingIcon={!exportingData ? <i className="ri-download-2-line" /> : undefined}
            >
              {exportingData ? 'Preparing' : 'Download'}
            </Button>
          </div>

          <div className="mt-3 rounded-xl border border-brand-accent1/30 bg-brand-accent1/10 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field
                className="flex-1"
                label="Delete account"
                hint={accountEmail ? `Type ${accountEmail} to confirm.` : 'Sign in again before deleting.'}
              >
                <Input
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder={accountEmail || 'Account email'}
                  autoComplete="off"
                  aria-label="Delete account confirmation email"
                />
              </Field>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteAccount}
                isLoading={deletingAccount}
                disabled={!accountEmail || deleteConfirmation.trim().toLowerCase() !== accountEmail.toLowerCase()}
                leadingIcon={!deletingAccount ? <i className="ri-delete-bin-line" /> : undefined}
              >
                {deletingAccount ? 'Deleting' : 'Delete account'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Save Button (bottom) */}
        <Button
          onClick={handleSave}
          disabled={saving}
          isLoading={saving}
          fullWidth
          size="lg"
          leadingIcon={!saving ? <i className="ri-save-line" /> : undefined}
        >
          {saving ? 'Saving changes…' : 'Save changes'}
        </Button>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="mb-4 w-full py-3 text-center text-sm font-medium text-brand-accent1 transition-colors hover:text-brand-accent1/80"
        >
          <i className="ri-logout-box-r-line mr-1.5" />
          Sign out
        </button>
      </div>

      <BottomNav />
    </main>
  )
}
