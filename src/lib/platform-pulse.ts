export type PlatformPulseInput = {
  unreadNotifications: number
  unreadMessages: number
  pendingStrands: number
  openLanterns: number
  availableSupporters: number
  closeMatches: number
  recentPosts: number
  upcomingActivities: number
  careReadiness: number
  careStageLabel: string
}

export type PlatformPulseAction = {
  id:
    | 'messages'
    | 'strands'
    | 'lanterns'
    | 'notifications'
    | 'people'
    | 'activities'
    | 'feed'
    | 'support'
    | 'care'
  label: string
  title: string
  body: string
  href: string
  icon: string
  count: number
  tone: 'gold' | 'sage' | 'blue' | 'violet' | 'terracotta'
}

export type PlatformPulseStat = {
  id: 'attention' | 'activity' | 'support' | 'care'
  label: string
  value: number | string
  detail: string
  icon: string
}

export type PlatformPulse = {
  status: 'needs_attention' | 'alive' | 'quiet'
  headline: string
  body: string
  priority_actions: PlatformPulseAction[]
  stats: PlatformPulseStat[]
}

function positiveInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function action(input: PlatformPulseAction): PlatformPulseAction {
  return { ...input, count: positiveInt(input.count) }
}

export function buildPlatformPulse(input: PlatformPulseInput): PlatformPulse {
  const unreadMessages = positiveInt(input.unreadMessages)
  const unreadNotifications = positiveInt(input.unreadNotifications)
  const pendingStrands = positiveInt(input.pendingStrands)
  const openLanterns = positiveInt(input.openLanterns)
  const availableSupporters = positiveInt(input.availableSupporters)
  const closeMatches = positiveInt(input.closeMatches)
  const recentPosts = positiveInt(input.recentPosts)
  const upcomingActivities = positiveInt(input.upcomingActivities)
  const careReadiness = Math.max(0, Math.min(100, positiveInt(input.careReadiness)))
  const attentionCount = unreadMessages + unreadNotifications + pendingStrands
  const liveCount = openLanterns + availableSupporters + closeMatches + recentPosts + upcomingActivities

  const actions = [
    action({
      id: 'messages',
      label: 'Messages',
      title: 'Reply to your messages',
      body: 'Someone has already opened a thread with you.',
      href: '/messages',
      icon: 'ri-mail-line',
      count: unreadMessages,
      tone: 'gold',
    }),
    action({
      id: 'strands',
      label: 'Connections',
      title: 'Review new connection requests',
      body: 'A request is waiting for your yes, no, or later.',
      href: '/strands',
      icon: 'ri-links-line',
      count: pendingStrands,
      tone: 'sage',
    }),
    action({
      id: 'lanterns',
      label: 'Lanterns',
      title: 'Answer an open lantern',
      body: 'A member is asking for someone steady right now.',
      href: '/support',
      icon: 'ri-hand-heart-line',
      count: openLanterns,
      tone: 'terracotta',
    }),
    action({
      id: 'notifications',
      label: 'Notifications',
      title: 'Catch up on notifications',
      body: 'New reactions, replies, or updates are waiting.',
      href: '/notifications',
      icon: 'ri-notification-3-line',
      count: unreadNotifications,
      tone: 'blue',
    }),
    action({
      id: 'people',
      label: 'People',
      title: 'Meet people like you',
      body: 'Fresh matches are ready when you want a warmer start.',
      href: '/people-like-you',
      icon: 'ri-team-line',
      count: closeMatches,
      tone: 'sage',
    }),
    action({
      id: 'activities',
      label: 'Activities',
      title: 'Join an upcoming activity',
      body: 'A group activity gives the week a shared moment.',
      href: '/community',
      icon: 'ri-calendar-event-line',
      count: upcomingActivities,
      tone: 'violet',
    }),
    action({
      id: 'feed',
      label: 'Community',
      title: 'See what changed in the room',
      body: 'Recent posts can be replied to, saved, or quietly read.',
      href: '/community',
      icon: 'ri-chat-3-line',
      count: recentPosts,
      tone: 'blue',
    }),
    action({
      id: 'support',
      label: 'Support',
      title: 'Someone is available now',
      body: 'If today is hard, there are members around.',
      href: '/support',
      icon: 'ri-lightbulb-flash-line',
      count: availableSupporters,
      tone: 'gold',
    }),
    action({
      id: 'care',
      label: 'Care plan',
      title: 'Run today’s care plan',
      body: `${input.careStageLabel || 'Care'} is your current program stage.`,
      href: '/care',
      icon: 'ri-road-map-line',
      count: Math.max(1, 100 - careReadiness),
      tone: 'blue',
    }),
  ]

  const priorityActions = actions
    .filter((item) => item.id === 'care' || item.count > 0)
    .sort((first, second) => {
      const priority = ['messages', 'strands', 'lanterns', 'notifications', 'people', 'activities', 'feed', 'support', 'care']
      return priority.indexOf(first.id) - priority.indexOf(second.id)
    })
    .slice(0, 6)

  const status: PlatformPulse['status'] =
    attentionCount > 0 ? 'needs_attention' : liveCount > 0 ? 'alive' : 'quiet'

  return {
    status,
    headline:
      status === 'needs_attention'
        ? 'Your people are waiting'
        : status === 'alive'
          ? 'KinSpace is moving right now'
          : 'A quiet room can still start well',
    body:
      status === 'needs_attention'
        ? 'Start with direct attention, then choose whether to support, connect, or settle into your care plan.'
        : status === 'alive'
          ? 'There are live openings across community, support, and your care program.'
          : 'No urgent activity is waiting. Start with the care plan and let the platform warm up around you.',
    priority_actions: priorityActions,
    stats: [
      {
        id: 'attention',
        label: 'Needs you',
        value: attentionCount,
        detail: 'messages, requests, and notifications',
        icon: 'ri-inbox-line',
      },
      {
        id: 'activity',
        label: 'Live activity',
        value: recentPosts + upcomingActivities + closeMatches,
        detail: 'posts, matches, and activities',
        icon: 'ri-pulse-line',
      },
      {
        id: 'support',
        label: 'Support now',
        value: openLanterns + availableSupporters,
        detail: 'open lanterns and available members',
        icon: 'ri-hand-heart-line',
      },
      {
        id: 'care',
        label: 'Care readiness',
        value: careReadiness,
        detail: input.careStageLabel || 'Care plan',
        icon: 'ri-road-map-line',
      },
    ],
  }
}
