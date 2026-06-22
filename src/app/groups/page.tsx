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
import { Card, Button, LinkButton, Input, Textarea, Field, Badge, Skeleton, EmptyState, Modal, Tabs, TabsList, TabsTrigger } from '@/components/ui'
import { cn } from '@/lib/cn'

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
      <Card key={group.id as string} interactive className="flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold text-brand-background">{group.name as string}</h2>
              {badge}
            </div>
            <p className="mt-1 text-xs capitalize text-brand-background/45">
              {(group.category as string | undefined) || 'general'} • {((group.type as string | undefined) || 'virtual')}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2/16 text-brand-accent2">
            <i className={`${typeof group.icon === 'string' && group.icon.startsWith('ri-') ? group.icon : 'ri-group-line'} text-xl`} aria-hidden="true" />
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-brand-background/70">
          {(group.description as string | undefined) || 'A live group on KinSpace.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-background/45">
          <span>{formatCompactNumber(group.members_count as number | undefined)} members</span>
          {(group.location as string | undefined) && (
            <span className="inline-flex items-center gap-1">
              <i className="ri-map-pin-2-line" aria-hidden="true" />
              {group.location as string}
            </span>
          )}
        </div>

        <div className="mt-5 pt-1">{action}</div>
      </Card>
    )
  }

  // Shared format/privacy selectors used by both create and edit sheets
  function FormatSelector({
    value,
    onChange,
  }: {
    value: 'virtual' | 'in-person' | 'hybrid'
    onChange: (next: 'virtual' | 'in-person' | 'hybrid') => void
  }) {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {(['virtual', 'in-person', 'hybrid'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            aria-pressed={value === type}
            className={cn(
              'rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
              value === type
                ? 'border-brand-accent2/40 bg-brand-accent2/12 text-brand-accent2'
                : 'border-brand-background/8 bg-brand-background/4 text-brand-background/65 hover:bg-brand-background/8',
            )}
          >
            {type}
          </button>
        ))}
      </div>
    )
  }

  function PrivacySelector({
    value,
    onChange,
  }: {
    value: 'public' | 'private'
    onChange: (next: 'public' | 'private') => void
  }) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {(['public', 'private'] as const).map((privacy) => (
          <button
            key={privacy}
            type="button"
            onClick={() => onChange(privacy)}
            aria-pressed={value === privacy}
            className={cn(
              'rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
              value === privacy
                ? 'border-brand-accent2/40 bg-brand-accent2/12 text-brand-accent2'
                : 'border-brand-background/8 bg-brand-background/4 text-brand-background/65 hover:bg-brand-background/8',
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <i className={privacy === 'public' ? 'ri-earth-line' : 'ri-lock-2-line'} aria-hidden="true" />
              <span>{privacy === 'public' ? 'Public' : 'Private'}</span>
            </div>
            <p className="mt-1 text-xs opacity-80">
              {privacy === 'public'
                ? 'Anyone on KinSpace can find and join.'
                : 'Hidden from Explore. Invite-only.'}
            </p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid space-y-6">
        <header className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">
                Groups
              </p>
              <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">
                Your circles, in one place
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
                Groups you might like, the ones you&apos;ve joined, and the ones you run - all together.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
              className="shrink-0"
            >
              Create group
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
            <TabsList className="flex w-full gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="min-w-fit">
                  <span className="flex items-center gap-2">
                    <i className={tab.icon} aria-hidden="true" />
                    {tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : null}

        {!loading && activeTab === 'for-you' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedGroups.length > 0 ? (
              recommendedGroups.map((group) =>
                renderGroupCard(
                  group,
                  <Button onClick={() => handleJoinGroup(group.id as string)} fullWidth>
                    Join group
                  </Button>,
                  (group.recommendation_score as number | undefined) ? (
                    <Badge tone="accent">
                      {Math.min(99, Math.max(52, Math.round(group.recommendation_score as number)))}% fit
                    </Badge>
                  ) : undefined,
                ),
              )
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-sparkling-line text-3xl" aria-hidden="true" />}
                title="Recommendations are warming up"
                description="As you join groups and share in the community, we'll suggest circles that fit you here."
                action={
                  <Button variant="secondary" onClick={() => setActiveTab('your-groups')}>
                    Start your own group
                  </Button>
                }
              />
            )}
          </section>
        )}

        {!loading && activeTab === 'following' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {joinedGroups.length > 0 ? (
              joinedGroups.map((membership) =>
                renderGroupCard(
                  membership.group || {},
                  <div className="flex w-full gap-2">
                    <LinkButton href={`/groups/${(membership.group?.id as string) ?? ''}`} fullWidth>
                      Open
                    </LinkButton>
                    <Button
                      variant="secondary"
                      onClick={() => handleLeaveGroup((membership.group?.id as string) ?? '')}
                    >
                      Leave
                    </Button>
                  </div>,
                ),
              )
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-bookmark-line text-3xl" aria-hidden="true" />}
                title="You haven't joined any groups yet"
                description="Browse what's recommended for you and join a circle that feels like home."
                action={
                  <Button onClick={() => setActiveTab('for-you')}>
                    Browse groups for you
                  </Button>
                }
              />
            )}
          </section>
        )}

        {!loading && activeTab === 'your-groups' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {createdGroups.length > 0 ? (
              createdGroups.map((membership) => {
                const group = membership.group || {}
                const isPrivate = Boolean(group.is_private)
                return renderGroupCard(
                  group,
                  <Button
                    onClick={() => openEditGroup(group)}
                    fullWidth
                    leadingIcon={<i className="ri-pencil-line" aria-hidden="true" />}
                  >
                    Edit group
                  </Button>,
                  <>
                    <Badge tone="info">Admin</Badge>
                    <Badge>
                      <i className={isPrivate ? 'ri-lock-2-line' : 'ri-earth-line'} aria-hidden="true" />
                      {isPrivate ? 'Private' : 'Public'}
                    </Badge>
                  </>,
                )
              })
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-team-line text-3xl" aria-hidden="true" />}
                title="You haven't created a group yet"
                description="Start a circle around what matters to you. You'll be its first member and host."
                action={
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
                  >
                    Create your first group
                  </Button>
                }
              />
            )}
          </section>
        )}
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create a group"
        className="max-w-2xl"
      >
        <p className="-mt-2 mb-5 text-sm text-brand-background/55">
          You&apos;ll be added as the first member and host.
        </p>

        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          <Field label="Group name" htmlFor="create-group-name">
            <Input
              id="create-group-name"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Name your group"
            />
          </Field>

          <Field label="Description" htmlFor="create-group-description" hint="A line or two helps people decide if it's right for them.">
            <Textarea
              id="create-group-description"
              value={newGroupDescription}
              onChange={(event) => setNewGroupDescription(event.target.value)}
              rows={4}
              placeholder="What support or conversation does this group offer?"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="create-group-category">
              <Input
                id="create-group-category"
                value={newGroupCategory}
                onChange={(event) => setNewGroupCategory(event.target.value)}
                placeholder="mental-health"
              />
            </Field>

            <Field label="Location" htmlFor="create-group-location" hint="Optional - only needed for in-person or hybrid.">
              <Input
                id="create-group-location"
                value={newGroupLocation}
                onChange={(event) => setNewGroupLocation(event.target.value)}
                placeholder="City or venue"
              />
            </Field>
          </div>

          <Field label="Format">
            <FormatSelector value={newGroupType} onChange={setNewGroupType} />
          </Field>

          <Field label="Privacy">
            <PrivacySelector value={newGroupPrivacy} onChange={setNewGroupPrivacy} />
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-brand-background/8 pt-5 sm:flex-row">
          <Button variant="secondary" fullWidth onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={handleCreateGroup}
            disabled={creating || !newGroupName.trim()}
            isLoading={creating}
          >
            {creating ? 'Creating…' : 'Create group'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editingGroup)}
        onClose={() => setEditingGroup(null)}
        title="Edit group"
        className="max-w-2xl"
      >
        <p className="-mt-2 mb-5 text-sm text-brand-background/55">
          Update the basics, or switch this group to private.
        </p>

        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          <Field label="Group name" htmlFor="edit-group-name">
            <Input
              id="edit-group-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </Field>

          <Field label="Description" htmlFor="edit-group-description">
            <Textarea
              id="edit-group-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={4}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="edit-group-category">
              <Input
                id="edit-group-category"
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
              />
            </Field>

            <Field label="Location" htmlFor="edit-group-location">
              <Input
                id="edit-group-location"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Format">
            <FormatSelector value={editType} onChange={setEditType} />
          </Field>

          <Field label="Privacy">
            <PrivacySelector value={editPrivacy} onChange={setEditPrivacy} />
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-brand-background/8 pt-5 sm:flex-row">
          <Button variant="secondary" fullWidth onClick={() => setEditingGroup(null)}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={handleSaveGroupEdit}
            disabled={savingEdit || !editName.trim()}
            isLoading={savingEdit}
          >
            {savingEdit ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Modal>

      <BottomNav />
    </PageFrame>
  )
}
