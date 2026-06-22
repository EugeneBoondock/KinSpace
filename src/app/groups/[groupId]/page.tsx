'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { DatabaseService } from '@/lib/database'
import { StorageService } from '@/lib/storage'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import PostComposer from '@/components/community/PostComposer'
import PostCard, { type PollDto, type PostShape } from '@/components/community/PostCard'
import { Avatar, Badge, Button, Card, EmptyState, Input, LinkButton, Skeleton, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatCompactNumber } from '@/lib/platform'

type MemberProfile = {
  user_id: string
  username: string
  full_name: string | null
  pseudonym: string | null
  is_anonymous: boolean
  avatar_url: string | null
}

type GroupMember = {
  user_id: string
  role: string
  status: string
  profile: MemberProfile | null
}

type GroupDetail = {
  id: string
  name: string
  description: string
  category: string
  type: string
  location: string | null
  tags: string[]
  is_private: boolean
  cover_url: string | null
  icon_url: string | null
  created_by: string
  members_count: number
  my_role: 'admin' | 'member' | null
  my_status: 'active' | 'muted' | 'banned' | null
  is_admin: boolean
  members: GroupMember[]
}

type Tab = 'feed' | 'members' | 'about' | 'settings'

function memberName(member: GroupMember): string {
  const profile = member.profile
  if (!profile || profile.is_anonymous) return 'Anonymous'
  return profile.full_name || profile.pseudonym || profile.username || 'A member'
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [feed, setFeed] = useState<PostShape[]>([])
  const [pollsByPost, setPollsByPost] = useState<Record<string, PollDto>>({})
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set())
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<Tab>('feed')

  // Invite
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviting, setInviting] = useState(false)

  // Settings form
  const [settingsName, setSettingsName] = useState('')
  const [settingsDescription, setSettingsDescription] = useState('')
  const [settingsPrivate, setSettingsPrivate] = useState(false)
  const [settingsCoverUrl, setSettingsCoverUrl] = useState<string | null>(null)
  const [settingsIconUrl, setSettingsIconUrl] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const iconFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const loadDetail = useCallback(async (): Promise<GroupDetail | null> => {
    try {
      const result = (await DatabaseService.getGroupDetail(groupId)) as GroupDetail | null
      setDetail(result)
      if (result) {
        setSettingsName(result.name ?? '')
        setSettingsDescription(result.description ?? '')
        setSettingsPrivate(Boolean(result.is_private))
        setSettingsCoverUrl(result.cover_url)
        setSettingsIconUrl(result.icon_url)
      }
      return result
    } catch (error) {
      console.error('Failed to load group detail:', error)
      toast('Could not load this group', 'error')
      return null
    }
  }, [groupId, toast])

  const loadFeed = useCallback(async () => {
    try {
      const rows = (await DatabaseService.getGroupFeed(groupId, 30)) as PostShape[]
      const posts = Array.isArray(rows) ? rows : []
      setFeed(posts)

      // Load polls, the viewer's reactions, and liked ids for these posts — the
      // same supporting data the public feed loads so PostCard renders fully.
      const pollIds = posts.filter((post) => (post.type as string | undefined) === 'poll').map((post) => post.id)
      const [reactionKeys, likedIds, pollMap] = await Promise.all([
        DatabaseService.getUserPostReactions(user?.userId).catch(() => [] as string[]),
        DatabaseService.getUserLikedPostIds(user?.userId).catch(() => [] as string[]),
        pollIds.length > 0
          ? DatabaseService.getPollsForPosts(pollIds).catch(() => ({} as Record<string, PollDto>))
          : Promise.resolve({} as Record<string, PollDto>),
      ])
      setUserReactions(new Set(reactionKeys as string[]))
      setLikedPostIds(new Set(likedIds as string[]))
      setPollsByPost((pollMap ?? {}) as Record<string, PollDto>)
    } catch (error) {
      console.error('Failed to load group feed:', error)
    }
  }, [groupId, user?.userId])

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      const result = await loadDetail()
      if (result && result.my_status !== 'banned') {
        await loadFeed()
      }
      setLoading(false)
    }
    if (user) load()
  }, [user, loadDetail, loadFeed])

  async function handleJoin() {
    if (!user) return
    try {
      await DatabaseService.joinGroup(groupId, user.userId)
      await loadDetail()
      await loadFeed()
      toast('Joined the group', 'success')
    } catch (error) {
      console.error('Failed to join group:', error)
      toast('Could not join group', 'error')
    }
  }

  async function handleLeave() {
    if (!user) return
    if (typeof window !== 'undefined' && !window.confirm('Leave this group?')) return
    try {
      await DatabaseService.leaveGroup(groupId, user.userId)
      await loadDetail()
      toast('Left the group', 'success')
    } catch (error) {
      console.error('Failed to leave group:', error)
      toast('Could not leave group', 'error')
    }
  }

  async function handlePromoteDemote(member: GroupMember) {
    const nextRole = member.role === 'admin' ? 'member' : 'admin'
    try {
      await DatabaseService.setMemberRole(groupId, member.user_id, nextRole)
      await loadDetail()
      toast(nextRole === 'admin' ? 'Promoted to admin' : 'Set to member', 'success')
    } catch (error) {
      console.error('Failed to update role:', error)
      toast('Could not update role', 'error')
    }
  }

  async function handleMuteToggle(member: GroupMember) {
    const nextStatus = member.status === 'muted' ? 'active' : 'muted'
    try {
      await DatabaseService.setMemberStatus(groupId, member.user_id, nextStatus)
      await loadDetail()
      toast(nextStatus === 'muted' ? 'Member muted' : 'Member unmuted', 'success')
    } catch (error) {
      console.error('Failed to update status:', error)
      toast('Could not update member', 'error')
    }
  }

  async function handleBan(member: GroupMember) {
    if (typeof window !== 'undefined' && !window.confirm(`Ban ${memberName(member)}?`)) return
    try {
      await DatabaseService.setMemberStatus(groupId, member.user_id, 'banned')
      await loadDetail()
      toast('Member banned', 'success')
    } catch (error) {
      console.error('Failed to ban member:', error)
      toast('Could not ban member', 'error')
    }
  }

  async function handleRemove(member: GroupMember) {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${memberName(member)} from the group?`)) return
    try {
      await DatabaseService.removeMember(groupId, member.user_id)
      await loadDetail()
      toast('Member removed', 'success')
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast('Could not remove member', 'error')
    }
  }

  async function handleInvite() {
    const username = inviteUsername.trim()
    if (!username) return
    setInviting(true)
    try {
      await DatabaseService.inviteToGroup(groupId, username)
      setInviteUsername('')
      toast('Invitation sent', 'success')
    } catch (error) {
      console.error('Failed to invite:', error)
      toast(error instanceof Error ? error.message : 'Could not send invite', 'error')
    } finally {
      setInviting(false)
    }
  }

  async function handleCoverFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return
    setUploadingCover(true)
    try {
      const url = await StorageService.uploadGroupCover(groupId, file)
      setSettingsCoverUrl(url)
      toast('Cover uploaded', 'success')
    } catch (error) {
      console.error('Failed to upload cover:', error)
      toast('Could not upload cover', 'error')
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleIconFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return
    setUploadingIcon(true)
    try {
      const url = await StorageService.uploadGroupCover(groupId, file)
      setSettingsIconUrl(url)
      toast('Logo uploaded', 'success')
    } catch (error) {
      console.error('Failed to upload logo:', error)
      toast('Could not upload logo', 'error')
    } finally {
      setUploadingIcon(false)
    }
  }

  async function handleSaveSettings() {
    if (!user) return
    setSavingSettings(true)
    try {
      await DatabaseService.updateGroup(groupId, user.userId, {
        name: settingsName.trim(),
        description: settingsDescription.trim(),
        isPrivate: settingsPrivate,
        coverUrl: settingsCoverUrl,
        iconUrl: settingsIconUrl,
      })
      await loadDetail()
      toast('Group updated', 'success')
    } catch (error) {
      console.error('Failed to update group:', error)
      toast(error instanceof Error ? error.message : 'Could not save changes', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="page-grid space-y-6">
          <Skeleton className="h-40 rounded-2xl sm:h-52" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!detail) {
    return (
      <PageFrame>
        <div className="page-grid">
          <Card>
            <EmptyState
              icon={<i className="ri-group-line text-3xl" aria-hidden="true" />}
              title="Group not found"
              description="This group may have been removed, or the link is no longer valid."
              action={<LinkButton href="/explore">Explore groups</LinkButton>}
            />
          </Card>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (detail.my_status === 'banned') {
    return (
      <PageFrame>
        <div className="page-grid space-y-6">
          <Card className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent1/15 text-brand-accent1">
              <i className="ri-forbid-2-line text-2xl" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-brand-background">You don&apos;t have access</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-brand-background/60">
              An admin has removed your access to {detail.name}. If you think this was a mistake, reach out to a group admin.
            </p>
            <div className="pt-2">
              <LinkButton href="/explore" variant="secondary">
                Explore other groups
              </LinkButton>
            </div>
          </Card>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const isMember = detail.my_role !== null
  const isCreator = user?.userId === detail.created_by
  const isMuted = detail.my_status === 'muted'

  // Pinned-in-group posts float to the top (most-recently-pinned first), then the
  // rest keep the server's newest-first order.
  const sortedFeed = feed.slice().sort((a, b) => {
    const aPinned = a.pinned_in_group_at ? new Date(a.pinned_in_group_at as string).getTime() : 0
    const bPinned = b.pinned_in_group_at ? new Date(b.pinned_in_group_at as string).getTime() : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return 0
  })

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'feed', label: 'Feed', icon: 'ri-discuss-line' },
    { id: 'members', label: 'Members', icon: 'ri-team-line' },
    { id: 'about', label: 'About', icon: 'ri-information-line' },
    ...(detail.is_admin ? [{ id: 'settings' as Tab, label: 'Settings', icon: 'ri-settings-3-line' }] : []),
  ]

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        {/* Header */}
        <header className="space-y-5">
          <div
            className={cn(
              'relative h-40 rounded-2xl border border-brand-line sm:h-52',
              !detail.cover_url && 'bg-gradient-to-br from-brand-accent2/30 via-brand-accent3/20 to-brand-accent5/25',
            )}
            style={
              detail.cover_url
                ? {
                    backgroundImage: `url(${detail.cover_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <div className="absolute -bottom-6 left-5">
              <Avatar
                src={detail.icon_url}
                name={detail.name}
                size="xl"
                className="ring-4 ring-brand-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="break-words text-2xl font-bold text-brand-background">{detail.name}</h1>
              <p className="text-sm text-brand-background/60">
                {formatCompactNumber(detail.members_count)} members
                {detail.category ? <span className="capitalize"> · {detail.category}</span> : null}
                {detail.is_private ? ' · Private' : ''}
              </p>
              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detail.tags.map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {detail.my_role === null && (
                <Button onClick={handleJoin} leadingIcon={<i className="ri-add-line" aria-hidden="true" />}>
                  Join
                </Button>
              )}
              {isMember && !isCreator && (
                <Button variant="secondary" onClick={handleLeave}>
                  Leave
                </Button>
              )}
              {detail.is_admin && (
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('settings')}
                  leadingIcon={<i className="ri-settings-3-line" aria-hidden="true" />}
                >
                  Settings
                </Button>
              )}
              <LinkButton
                href={`/groups/${groupId}/sessions`}
                variant="secondary"
                leadingIcon={<i className="ri-calendar-event-line" aria-hidden="true" />}
              >
                Sessions
              </LinkButton>
            </div>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Group sections"
            className="flex min-w-0 gap-1 overflow-x-auto rounded-full bg-brand-background/5 p-1.5"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex min-w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                    isActive
                      ? 'bg-brand-background/20 text-brand-background shadow-sm'
                      : 'text-brand-background/60 hover:text-brand-background/90',
                  )}
                >
                  <i className={tab.icon} aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </header>

        {/* FEED */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {isMember && !isMuted && (
              <PostComposer groupId={groupId} onPosted={loadFeed} />
            )}

            {isMember && isMuted && (
              <Card>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent2/16 text-brand-accent2">
                    <i className="ri-volume-mute-line text-lg" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-background">You&apos;re muted in this group</p>
                    <p className="text-xs text-brand-background/55">
                      You can still read the conversation, but posting is paused until an admin unmutes you.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!isMember && (
              <Card>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-sm text-brand-background/70">Join this group to share and reply.</p>
                  <Button onClick={handleJoin} leadingIcon={<i className="ri-add-line" aria-hidden="true" />}>
                    Join to post
                  </Button>
                </div>
              </Card>
            )}

            {feed.length === 0 ? (
              <EmptyState
                icon={<i className="ri-chat-3-line text-3xl" aria-hidden="true" />}
                title="No posts yet"
                description={isMember ? 'Be the first to start a conversation here.' : 'Join to be part of the first conversation.'}
              />
            ) : (
              <section className="space-y-4">
                {sortedFeed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    poll={pollsByPost[post.id]}
                    reacted={userReactions}
                    initialLiked={likedPostIds.has(post.id)}
                    currentUserId={user?.userId}
                    isGroupAdmin={detail.is_admin}
                    onChanged={loadFeed}
                  />
                ))}
              </section>
            )}
          </div>
        )}

        {/* MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {(detail.is_admin || isMember) && (
              <Card className="space-y-3">
                <p className="text-sm font-semibold text-brand-background">Invite someone</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={inviteUsername}
                    onChange={(event) => setInviteUsername(event.target.value)}
                    placeholder="Their username"
                    aria-label="Username to invite"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleInvite}
                    disabled={inviting || !inviteUsername.trim()}
                    isLoading={inviting}
                  >
                    {inviting ? 'Inviting…' : 'Invite'}
                  </Button>
                </div>
              </Card>
            )}

            <Card className="space-y-3">
              <p className="text-sm font-semibold text-brand-background">
                Members · {formatCompactNumber(detail.members.length)}
              </p>
              <ul className="divide-y divide-brand-background/8">
                {detail.members.map((member) => {
                  const name = memberName(member)
                  const isSelf = user?.userId === member.user_id
                  const memberIsCreator = member.user_id === detail.created_by
                  const canManage = detail.is_admin && !memberIsCreator && !isSelf
                  return (
                    <li key={member.user_id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar
                        src={member.profile?.is_anonymous ? null : member.profile?.avatar_url}
                        name={name}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-brand-background">{name}</p>
                          {member.role === 'admin' && <Badge tone="info">Admin</Badge>}
                          {member.status === 'muted' && <Badge tone="warning">Muted</Badge>}
                        </div>
                        {member.profile?.username && !member.profile.is_anonymous && (
                          <p className="truncate text-xs text-brand-background/45">@{member.profile.username}</p>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => handlePromoteDemote(member)}>
                            {member.role === 'admin' ? 'Demote' : 'Promote'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleMuteToggle(member)}>
                            {member.status === 'muted' ? 'Unmute' : 'Mute'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleBan(member)}>
                            Ban
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleRemove(member)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>
        )}

        {/* ABOUT */}
        {activeTab === 'about' && (
          <Card className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">About</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-background/75">
                {detail.description || 'This group has not added a description yet.'}
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-brand-background/45">Category</dt>
                <dd className="text-sm capitalize text-brand-background">{detail.category || 'General'}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-background/45">Format</dt>
                <dd className="text-sm capitalize text-brand-background">{detail.type || 'Virtual'}</dd>
              </div>
              {detail.location && (
                <div>
                  <dt className="text-xs text-brand-background/45">Location</dt>
                  <dd className="text-sm text-brand-background">{detail.location}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-brand-background/45">Privacy</dt>
                <dd className="text-sm text-brand-background">{detail.is_private ? 'Private' : 'Public'}</dd>
              </div>
            </dl>

            {detail.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.tags.map((tag) => (
                  <Badge key={tag}>#{tag}</Badge>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && detail.is_admin && (
          <Card className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">Group settings</p>

            <div className="space-y-1.5">
              <label htmlFor="group-name" className="text-sm font-medium text-brand-background">
                Name
              </label>
              <Input
                id="group-name"
                value={settingsName}
                onChange={(event) => setSettingsName(event.target.value)}
                placeholder="Group name"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="group-description" className="text-sm font-medium text-brand-background">
                Description
              </label>
              <Textarea
                id="group-description"
                value={settingsDescription}
                onChange={(event) => setSettingsDescription(event.target.value)}
                rows={4}
                placeholder="What is this group about?"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(['public', 'private'] as const).map((option) => {
                const selected = (option === 'private') === settingsPrivate
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSettingsPrivate(option === 'private')}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                      selected
                        ? 'border-brand-accent2/40 bg-brand-accent2/12 text-brand-accent2'
                        : 'border-brand-background/8 bg-brand-background/[0.04] text-brand-background/65 hover:bg-brand-background/8',
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <i className={option === 'public' ? 'ri-earth-line' : 'ri-lock-2-line'} aria-hidden="true" />
                      <span>{option === 'public' ? 'Public' : 'Private'}</span>
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      {option === 'public' ? 'Anyone can find and join.' : 'Hidden from Explore. Invite-only.'}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-background">Cover image</p>
                <div
                  className={cn(
                    'h-28 rounded-2xl border border-brand-line',
                    !settingsCoverUrl && 'bg-gradient-to-br from-brand-accent2/30 via-brand-accent3/20 to-brand-accent5/25',
                  )}
                  style={
                    settingsCoverUrl
                      ? { backgroundImage: `url(${settingsCoverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : undefined
                  }
                />
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => coverFileRef.current?.click()}
                  disabled={uploadingCover}
                  isLoading={uploadingCover}
                  leadingIcon={<i className="ri-upload-2-line" aria-hidden="true" />}
                >
                  {uploadingCover ? 'Uploading…' : 'Upload cover'}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-background">Logo</p>
                <Avatar src={settingsIconUrl} name={settingsName || detail.name} size="lg" />
                <input ref={iconFileRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => iconFileRef.current?.click()}
                  disabled={uploadingIcon}
                  isLoading={uploadingIcon}
                  leadingIcon={<i className="ri-upload-2-line" aria-hidden="true" />}
                >
                  {uploadingIcon ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end border-t border-brand-background/8 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings || !settingsName.trim()}
                isLoading={savingSettings}
              >
                {savingSettings ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
