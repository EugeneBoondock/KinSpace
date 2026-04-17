'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { geocodeQueries } from '@/lib/map-client'
import { formatCompactNumber } from '@/lib/platform'

type Tab = 'for-you' | 'following' | 'your-groups'

type Membership = {
  id: string
  role?: string
  group?: Record<string, unknown> | null
}

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'for-you', label: 'For You', icon: 'ri-sparkling-line' },
  { id: 'following', label: 'Joined', icon: 'ri-bookmark-line' },
  { id: 'your-groups', label: 'Created', icon: 'ri-team-line' },
]

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('for-you')
  const [recommendedGroups, setRecommendedGroups] = useState<Record<string, unknown>[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupCategory, setNewGroupCategory] = useState('general')
  const [newGroupType, setNewGroupType] = useState<'virtual' | 'in-person' | 'hybrid'>('virtual')
  const [newGroupLocation, setNewGroupLocation] = useState('')
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'public' | 'private'>('public')

  // Edit mode
  const [editingGroup, setEditingGroup] = useState<Record<string, unknown> | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('general')
  const [editType, setEditType] = useState<'virtual' | 'in-person' | 'hybrid'>('virtual')
  const [editLocation, setEditLocation] = useState('')
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    async function loadGroupsPage() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const [recommended, userMemberships] = await Promise.all([
          DatabaseService.getRecommendedGroups(user.userId, 8),
          DatabaseService.getUserGroupMemberships(user.userId),
        ])

        setRecommendedGroups(recommended as Record<string, unknown>[])
        setMemberships(userMemberships as Membership[])
      } catch (error) {
        console.error('Failed to load groups page:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) loadGroupsPage()
  }, [authLoading, user])

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateModal(true)
    }
  }, [searchParams])

  const joinedGroups = useMemo(
    () => memberships.filter((membership) => membership.group),
    [memberships],
  )

  const createdGroups = useMemo(
    () => memberships.filter((membership) => membership.role === 'admin' && membership.group),
    [memberships],
  )

  async function refreshGroups() {
    if (!user) return
    const [recommended, userMemberships] = await Promise.all([
      DatabaseService.getRecommendedGroups(user.userId, 8),
      DatabaseService.getUserGroupMemberships(user.userId),
    ])
    setRecommendedGroups(recommended as Record<string, unknown>[])
    setMemberships(userMemberships as Membership[])
  }

  async function handleCreateGroup() {
    if (!user || !newGroupName.trim()) return
    setCreating(true)

    try {
      let latitude: number | null = null
      let longitude: number | null = null

      if (newGroupLocation.trim() && newGroupType !== 'virtual') {
        const geocodes = await geocodeQueries([`${newGroupLocation.trim()}, ${newGroupName.trim()}`])
        const match = geocodes.get(`${newGroupLocation.trim()}, ${newGroupName.trim()}`)
        latitude = match?.latitude ?? null
        longitude = match?.longitude ?? null
      }

      await DatabaseService.createGroup(user.userId, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        category: newGroupCategory.trim().toLowerCase(),
        type: newGroupType,
        location: newGroupLocation.trim() || null,
        latitude,
        longitude,
        isPrivate: newGroupPrivacy === 'private',
      })

      await refreshGroups()
      setShowCreateModal(false)
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupCategory('general')
      setNewGroupType('virtual')
      setNewGroupLocation('')
      setNewGroupPrivacy('public')
      setActiveTab('your-groups')
      toast('Group created', 'success')
    } catch (error) {
      console.error('Failed to create group:', error)
      toast('Could not create group', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) return
    try {
      await DatabaseService.joinGroup(groupId, user.userId)
      await refreshGroups()
      setActiveTab('following')
      toast('Joined the group', 'success')
    } catch (error) {
      console.error('Failed to join group:', error)
      toast('Could not join group', 'error')
    }
  }

  function openEditGroup(group: Record<string, unknown>) {
    setEditingGroup(group)
    setEditName((group.name as string | undefined) ?? '')
    setEditDescription((group.description as string | undefined) ?? '')
    setEditCategory((group.category as string | undefined) ?? 'general')
    setEditType(((group.type as 'virtual' | 'in-person' | 'hybrid' | undefined) ?? 'virtual'))
    setEditLocation((group.location as string | undefined) ?? '')
    setEditPrivacy(group.is_private ? 'private' : 'public')
  }

  async function handleSaveGroupEdit() {
    if (!user || !editingGroup) return
    setSavingEdit(true)
    try {
      await DatabaseService.updateGroup(editingGroup.id as string, user.userId, {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory.trim().toLowerCase(),
        type: editType,
        location: editLocation.trim() || null,
        isPrivate: editPrivacy === 'private',
      })
      await refreshGroups()
      setEditingGroup(null)
      toast('Group updated', 'success')
    } catch (error) {
      console.error('Failed to update group:', error)
      toast(error instanceof Error ? error.message : 'Could not save changes', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleLeaveGroup(groupId: string) {
    if (!user) return
    if (typeof window !== 'undefined' && !window.confirm('Leave this group?')) return
    try {
      await DatabaseService.leaveGroup(groupId, user.userId)
      await refreshGroups()
      toast('Left the group', 'success')
    } catch (error) {
      console.error('Failed to leave group:', error)
      toast('Could not leave group', 'error')
    }
  }

  function renderGroupCard(group: Record<string, unknown>, action: ReactNode, badge?: ReactNode) {
    return (
      <article key={group.id as string} className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#eedfc8]">{group.name as string}</h2>
              {badge}
            </div>
            <p className="mt-1 text-xs text-[#eedfc8]/45">
              {(group.category as string | undefined) || 'general'} • {((group.type as string | undefined) || 'virtual')}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D19A58]/16 text-[#D19A58]">
            <i className={`${(group.icon as string | undefined) || 'ri-group-line'} text-xl`} />
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
          {(group.description as string | undefined) || 'A live group on KinSpace.'}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
          <span>{formatCompactNumber(group.members_count as number | undefined)} members</span>
          {(group.location as string | undefined) && <span>{group.location as string}</span>}
        </div>

        <div className="mt-5">{action}</div>
      </article>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Groups
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Organize the circles that matter</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                Recommendations, memberships, and the groups you create now all come from the same live data.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary !py-2.5 !px-4 text-sm"
            >
              <i className="ri-add-line mr-1.5" />
              Create group
            </button>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="page-card-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 skeleton rounded-3xl" />
            ))}
          </div>
        ) : null}

        {!loading && activeTab === 'for-you' && (
          <section className="page-card-grid">
            {recommendedGroups.length > 0 ? (
              recommendedGroups.map((group) =>
                renderGroupCard(
                  group,
                  <button
                    onClick={() => handleJoinGroup(group.id as string)}
                    className="btn-primary w-full !py-2.5 text-sm"
                  >
                    Join group
                  </button>,
                  (group.recommendation_score as number | undefined) ? (
                    <span className="badge bg-[#D19A58]/15 text-[#D19A58]">
                      {Math.min(99, Math.max(52, Math.round(group.recommendation_score as number)))}% fit
                    </span>
                  ) : undefined,
                ),
              )
            ) : (
              <div className="card-light text-center">
                <i className="ri-sparkling-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">We do not have enough signal for recommendations yet.</p>
              </div>
            )}
          </section>
        )}

        {!loading && activeTab === 'following' && (
          <section className="page-card-grid">
            {joinedGroups.length > 0 ? (
              joinedGroups.map((membership) =>
                renderGroupCard(
                  membership.group || {},
                  <button
                    onClick={() => handleLeaveGroup((membership.group?.id as string) ?? '')}
                    className="btn-secondary w-full !py-2.5 text-sm hover:text-[#B85C3A]"
                  >
                    Leave group
                  </button>,
                ),
              )
            ) : (
              <div className="card-light text-center">
                <i className="ri-bookmark-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">You have not joined any groups yet.</p>
              </div>
            )}
          </section>
        )}

        {!loading && activeTab === 'your-groups' && (
          <section className="page-card-grid">
            {createdGroups.length > 0 ? (
              createdGroups.map((membership) => {
                const group = membership.group || {}
                const isPrivate = Boolean(group.is_private)
                return renderGroupCard(
                  group,
                  <button
                    onClick={() => openEditGroup(group)}
                    className="btn-primary w-full !py-2.5 text-sm"
                  >
                    <i className="ri-pencil-line mr-1.5" /> Edit group
                  </button>,
                  <>
                    <span className="badge bg-[#6B8A83]/18 text-[#6B8A83]">Admin</span>
                    <span className="badge text-[10px]">
                      {isPrivate ? '🔒 Private' : '🌍 Public'}
                    </span>
                  </>,
                )
              })
            ) : (
              <div className="card-light text-center">
                <i className="ri-team-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">You have not created a group yet.</p>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4 !py-2.5 !px-4 text-xs">
                  Create your first group
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <button
            aria-label="Close create group modal"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-[#eedfc8]/10 bg-brand-primary md:max-h-[85dvh] md:rounded-[2rem]">
            <div className="flex items-center justify-between gap-3 border-b border-[#eedfc8]/8 p-5">
              <div>
                <h2 className="text-xl font-bold text-[#eedfc8]">Create a live group</h2>
                <p className="mt-1 text-sm text-[#eedfc8]/50">
                  This adds you as the first member.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#eedfc8]/60"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Group name
                  </label>
                  <input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    className="input-field"
                    placeholder="Name your group"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Description
                  </label>
                  <textarea
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                    className="input-field resize-none"
                    rows={4}
                    placeholder="What support or conversation does this group offer?"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Category
                  </label>
                  <input
                    value={newGroupCategory}
                    onChange={(event) => setNewGroupCategory(event.target.value)}
                    className="input-field"
                    placeholder="mental-health"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Location
                  </label>
                  <input
                    value={newGroupLocation}
                    onChange={(event) => setNewGroupLocation(event.target.value)}
                    className="input-field"
                    placeholder="Optional city or venue"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Format
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['virtual', 'in-person', 'hybrid'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewGroupType(type)}
                      className={`rounded-2xl border px-4 py-3 text-sm capitalize transition-all ${
                        newGroupType === type
                          ? 'border-[#D19A58]/40 bg-[#D19A58]/12 text-[#D19A58]'
                          : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 text-[#eedfc8]/65'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Privacy
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['public', 'private'] as const).map((privacy) => (
                    <button
                      key={privacy}
                      onClick={() => setNewGroupPrivacy(privacy)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        newGroupPrivacy === privacy
                          ? 'border-[#D19A58]/40 bg-[#D19A58]/12 text-[#D19A58]'
                          : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 text-[#eedfc8]/65'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{privacy === 'public' ? '🌍 Public' : '🔒 Private'}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-80">
                        {privacy === 'public'
                          ? 'Anyone on KinSpace can find and join.'
                          : 'Hidden from Explore. Invite-only.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#eedfc8]/8 bg-brand-primary/60 p-5 sm:flex-row">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1 !py-3 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creating || !newGroupName.trim()}
                className="btn-primary flex-1 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <button
            aria-label="Close edit group"
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditingGroup(null)}
          />
          <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-[#eedfc8]/10 bg-brand-primary md:max-h-[85dvh] md:rounded-[2rem]">
            <div className="flex items-center justify-between gap-3 border-b border-[#eedfc8]/8 p-5">
              <div>
                <h2 className="text-xl font-bold text-[#eedfc8]">Edit group</h2>
                <p className="mt-1 text-sm text-[#eedfc8]/50">
                  Change the basics or flip to private.
                </p>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#eedfc8]/60"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Group name
                  </label>
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="input-field resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Category
                  </label>
                  <input
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                    Location
                  </label>
                  <input
                    value={editLocation}
                    onChange={(event) => setEditLocation(event.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Format
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['virtual', 'in-person', 'hybrid'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setEditType(type)}
                      className={`rounded-2xl border px-4 py-3 text-sm capitalize transition-all ${
                        editType === type
                          ? 'border-[#D19A58]/40 bg-[#D19A58]/12 text-[#D19A58]'
                          : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 text-[#eedfc8]/65'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Privacy
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['public', 'private'] as const).map((privacy) => (
                    <button
                      key={privacy}
                      onClick={() => setEditPrivacy(privacy)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        editPrivacy === privacy
                          ? 'border-[#D19A58]/40 bg-[#D19A58]/12 text-[#D19A58]'
                          : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 text-[#eedfc8]/65'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{privacy === 'public' ? '🌍 Public' : '🔒 Private'}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-80">
                        {privacy === 'public'
                          ? 'Anyone on KinSpace can find and join.'
                          : 'Hidden from Explore. Invite-only.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#eedfc8]/8 bg-brand-primary/60 p-5 sm:flex-row">
              <button
                onClick={() => setEditingGroup(null)}
                className="btn-secondary flex-1 !py-3 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroupEdit}
                disabled={savingEdit || !editName.trim()}
                className="btn-primary flex-1 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </PageFrame>
  )
}
