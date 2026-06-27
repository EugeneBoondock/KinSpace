type GuideRoomMessage = {
  roomId: string | null
  sessionId: string | null
}

type GuideRoomSession = {
  id: string
  userId: string
} | null

export function canDeleteGuideRoomMessage(
  actorId: string,
  message: GuideRoomMessage,
  session: GuideRoomSession,
) {
  if (!actorId) return false
  if (message.roomId !== `guided-support-${actorId}`) return false
  if (!message.sessionId || !session) return true

  return session.id === message.sessionId && session.userId === actorId
}
