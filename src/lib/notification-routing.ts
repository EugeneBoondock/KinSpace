export type NotificationRouteSource = {
  type?: string | null
  data?: Record<string, unknown> | null
}

export type NotificationAction = {
  label: string
  href: string
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNotificationData(source: NotificationRouteSource): Record<string, unknown> {
  return source.data && typeof source.data === 'object' ? source.data : {}
}

function readGroupId(data: Record<string, unknown>): string | null {
  return readString(data.group_id) ?? readString(data.groupId)
}

export function notificationAction(source: NotificationRouteSource): NotificationAction | null {
  const data = readNotificationData(source)
  const type = source.type ?? ''
  const fromUserId = readString(data.from_user_id) ?? readString(data.fromUserId)

  if (type === 'dm' && fromUserId) return { label: 'Open conversation', href: `/messages?to=${fromUserId}` }
  if (type === 'connection_request' || type === 'connection_accepted') return { label: 'View your strands', href: '/strands' }
  if (type === 'quiet_checkin') return { label: 'Go to your space', href: '/dashboard' }
  if (type === 'medication_reminder') return { label: 'Open reminders', href: '/dashboard?meds=1' }

  const groupId = readGroupId(data)
  if (type === 'group_join_request' && groupId) return { label: 'Review request', href: `/groups/${groupId}` }
  if ((type === 'group_invite' || type === 'group_role' || type === 'group_request_approved') && groupId) {
    return { label: 'Open the group', href: `/groups/${groupId}` }
  }

  const postId = readString(data.post_id) ?? readString(data.postId)
  if (type === 'expertise') {
    if (groupId) return { label: 'Open the group', href: `/groups/${groupId}` }
    if (postId) return { label: 'View the post', href: '/community' }
    return { label: 'Go to community', href: '/community' }
  }

  return null
}

export function buildSystemNotificationData(source: NotificationRouteSource): Record<string, unknown> {
  const data = readNotificationData(source)
  const action = notificationAction(source)
  const existingUrl = readString(data.url)
  return {
    ...data,
    type: source.type,
    url: action?.href ?? existingUrl ?? '/notifications',
  }
}
