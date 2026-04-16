'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PlatformAvatarPicker from '@/components/PlatformAvatarPicker'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { EncryptionService } from '@/lib/encryption'
import { invalidateCachedProfile } from '@/lib/profile-cache'
import { resolveAvatarUrl } from '@/lib/profile-avatars'
import { StorageService } from '@/lib/storage'

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
  preferred_communication: string
  notify_matches: boolean
  notify_messages: boolean
  notify_groups: boolean
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
  preferred_communication: 'chat',
  notify_matches: true,
  notify_messages: true,
  notify_groups: true,
}

const pronounOptions = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Prefer not to say']
const communicationOptions = [
  { value: 'chat', label: 'Chat', icon: 'ri-chat-1-line' },
  { value: 'voice', label: 'Voice', icon: 'ri-mic-line' },
  { value: 'video', label: 'Video', icon: 'ri-vidicon-line' },
]

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData>(defaultProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [conditionInput, setConditionInput] = useState('')
  const [comorbidityInput, setComorbidityInput] = useState('')
  const [medicationInput, setMedicationInput] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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
            age: data.age ? String(data.age) : '',
            notify_matches: data.notify_matches !== false,
            notify_messages: data.notify_messages !== false,
            notify_groups: data.notify_groups !== false,
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
        preferred_communication: profile.preferred_communication,
        notify_matches: profile.notify_matches,
        notify_messages: profile.notify_messages,
        notify_groups: profile.notify_groups,
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

  const currentAvatarUrl = resolveAvatarUrl({
    avatar_url: profile.avatar_url,
    full_name: profile.full_name,
    userId: user?.userId,
    username: profile.username,
  })

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-24 md:pb-28">
        <div className="mx-auto w-full max-w-4xl px-4 pt-14 space-y-6">
          <div className="h-8 w-32 skeleton rounded-lg" />
          <div className="h-20 skeleton rounded-xl" />
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-24 md:pb-28">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded-xl flex items-center gap-2 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-brand-accent3/90 text-[#eedfc8]'
            : 'bg-[#B85C3A]/90 text-white'
        }`}>
          <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-[#eedfc8]/5 flex items-center justify-center text-[#eedfc8] hover:bg-[#eedfc8]/10 transition-colors"
            >
              <i className="ri-arrow-left-line text-lg" />
            </button>
            <h1 className="text-xl font-bold text-[#eedfc8]">Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary !py-2 !px-5 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <i className="ri-loader-4-line animate-spin" /> Saving...
              </>
            ) : (
              <>
                <i className="ri-check-line" /> Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 space-y-6">
        {/* Profile Section */}
        <section>
          <h2 className="section-title flex items-center gap-2">
            <i className="ri-user-line text-[#D19A58]" /> Profile
          </h2>
          <div className="space-y-4">
            {/* Avatar Upload Placeholder */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <ProfileAvatar
                  alt="Avatar"
                  avatarUrl={profile.avatar_url}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#D19A58]"
                  fullName={profile.full_name}
                  userId={user?.userId}
                  username={profile.username}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#B85C3A] flex items-center justify-center text-white shadow-lg"
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
              <div className="flex-1 space-y-3">
                <p className="text-[#eedfc8] text-sm font-medium">Profile Photo</p>
                <p className="text-[#eedfc8]/40 text-xs">
                  Upload your own or choose a KinSpace icon.
                </p>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="btn-secondary !py-2 !px-4 disabled:opacity-60"
                >
                  Upload from device
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[#eedfc8]/50 text-xs font-medium">KinSpace icons</p>
              <PlatformAvatarPicker
                disabled={uploadingAvatar}
                onSelect={handlePlatformAvatarSelect}
                selectedAvatarUrl={currentAvatarUrl}
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Full Name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your full name"
                className="input-field"
              />
            </div>

            {/* Username */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40 text-sm">@</span>
                <input
                  type="text"
                  value={profile.username}
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
                  className={`input-field !pl-8 ${usernameError ? '!border-[#B85C3A]/60' : ''}`}
                />
              </div>
              {usernameError && (
                <p className="mt-1 text-xs text-[#B85C3A]">{usernameError}</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Location</label>
              <div className="relative">
                <i className="ri-map-pin-2-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  placeholder="City, State"
                  className="input-field !pl-9"
                />
              </div>
            </div>

            {/* Age & Pronouns Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Age</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                  placeholder="Age"
                  min="13"
                  max="120"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Pronouns</label>
                <select
                  value={profile.pronouns}
                  onChange={(e) => setProfile((p) => ({ ...p, pronouns: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Select...</option>
                  {pronounOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Health Info Section */}
        <section>
          <h2 className="section-title flex items-center gap-2">
            <i className="ri-heart-pulse-line text-[#B85C3A]" /> Health Info
          </h2>
          <div className="space-y-4">
            {/* Conditions */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Conditions</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.conditions.map((c, i) => (
                  <span key={c} className="badge bg-brand-accent1/20 text-brand-accent1 flex items-center gap-1">
                    {c}
                    <button onClick={() => handleRemoveTag('conditions', i)} className="hover:text-white">
                      <i className="ri-close-line text-xs" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('conditions', conditionInput, setConditionInput)
                    }
                  }}
                  placeholder="Add a condition..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => handleAddTag('conditions', conditionInput, setConditionInput)}
                  className="btn-secondary !py-0 !px-3"
                >
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>

            {/* Comorbidities */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Comorbidities</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.comorbidities.map((c, i) => (
                  <span key={c} className="badge bg-brand-accent2/20 text-[#D19A58] flex items-center gap-1">
                    {c}
                    <button onClick={() => handleRemoveTag('comorbidities', i)} className="hover:text-white">
                      <i className="ri-close-line text-xs" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comorbidityInput}
                  onChange={(e) => setComorbidityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('comorbidities', comorbidityInput, setComorbidityInput)
                    }
                  }}
                  placeholder="Add a comorbidity..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => handleAddTag('comorbidities', comorbidityInput, setComorbidityInput)}
                  className="btn-secondary !py-0 !px-3"
                >
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>

            {/* Medications */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Medications</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.medications.map((m, i) => (
                  <span key={m} className="badge bg-brand-accent3/20 text-brand-accent3 flex items-center gap-1">
                    {m}
                    <button onClick={() => handleRemoveTag('medications', i)} className="hover:text-white">
                      <i className="ri-close-line text-xs" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag('medications', medicationInput, setMedicationInput)
                    }
                  }}
                  placeholder="Add a medication..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => handleAddTag('medications', medicationInput, setMedicationInput)}
                  className="btn-secondary !py-0 !px-3"
                >
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-1.5 block">Current Status</label>
              <input
                type="text"
                value={profile.status}
                onChange={(e) => setProfile((p) => ({ ...p, status: e.target.value }))}
                placeholder="e.g., In treatment, Managing, In recovery..."
                className="input-field"
              />
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section>
          <h2 className="section-title flex items-center gap-2">
            <i className="ri-shield-check-line text-brand-accent3" /> Privacy
          </h2>
          <div className="space-y-4">
            {/* Anonymous Toggle */}
            <div className="card-light flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#eedfc8]/10 flex items-center justify-center">
                  <i className="ri-spy-line text-[#eedfc8]/70" />
                </div>
                <div>
                  <p className="text-[#eedfc8] text-sm font-medium">Anonymous Mode</p>
                  <p className="text-[#eedfc8]/40 text-xs">Hide your identity in posts</p>
                </div>
              </div>
              <button
                onClick={() => setProfile((p) => ({ ...p, is_anonymous: !p.is_anonymous }))}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  profile.is_anonymous ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${
                  profile.is_anonymous ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Communication Preferences */}
            <div>
              <label className="text-[#eedfc8]/60 text-xs font-medium mb-2 block">Preferred Communication</label>
              <div className="grid grid-cols-3 gap-2">
                {communicationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile((p) => ({ ...p, preferred_communication: opt.value }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      profile.preferred_communication === opt.value
                        ? 'bg-[#D19A58]/15 border-[#D19A58]/40 text-[#D19A58]'
                        : 'bg-[#eedfc8]/5 border-[#eedfc8]/10 text-[#eedfc8]/50'
                    }`}
                  >
                    <i className={`${opt.icon} text-lg`} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="section-title flex items-center gap-2">
            <i className="ri-notification-3-line text-[#D19A58]" /> Notifications
          </h2>
          <div className="space-y-3">
            {/* Matches Toggle */}
            <div className="card-light flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-accent1/15 flex items-center justify-center">
                  <i className="ri-hearts-line text-brand-accent1" />
                </div>
                <div>
                  <p className="text-[#eedfc8] text-sm font-medium">Matches</p>
                  <p className="text-[#eedfc8]/40 text-xs">New match notifications</p>
                </div>
              </div>
              <button
                onClick={() => setProfile((p) => ({ ...p, notify_matches: !p.notify_matches }))}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  profile.notify_matches ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${
                  profile.notify_matches ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Messages Toggle */}
            <div className="card-light flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-accent2/15 flex items-center justify-center">
                  <i className="ri-chat-1-line text-[#D19A58]" />
                </div>
                <div>
                  <p className="text-[#eedfc8] text-sm font-medium">Messages</p>
                  <p className="text-[#eedfc8]/40 text-xs">New message alerts</p>
                </div>
              </div>
              <button
                onClick={() => setProfile((p) => ({ ...p, notify_messages: !p.notify_messages }))}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  profile.notify_messages ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${
                  profile.notify_messages ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Groups Toggle */}
            <div className="card-light flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-accent3/15 flex items-center justify-center">
                  <i className="ri-group-line text-brand-accent3" />
                </div>
                <div>
                  <p className="text-[#eedfc8] text-sm font-medium">Groups</p>
                  <p className="text-[#eedfc8]/40 text-xs">Group activity updates</p>
                </div>
              </div>
              <button
                onClick={() => setProfile((p) => ({ ...p, notify_groups: !p.notify_groups }))}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  profile.notify_groups ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${
                  profile.notify_groups ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* Save Button (bottom) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 !py-3 disabled:opacity-50"
        >
          {saving ? (
            <>
              <i className="ri-loader-4-line animate-spin" /> Saving Changes...
            </>
          ) : (
            <>
              <i className="ri-save-line" /> Save Changes
            </>
          )}
        </button>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 text-center text-[#B85C3A] text-sm font-medium hover:text-[#B85C3A]/80 transition-colors mb-4"
        >
          <i className="ri-logout-box-r-line mr-1.5" />
          Sign Out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
