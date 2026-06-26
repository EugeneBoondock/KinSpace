import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate } from './_shared'
import {
  commentReactions,
  communityPosts,
  gameScores,
  groupMembers,
  medicationReminders,
  medicationTakenLog,
  moodCheckins,
  postComments,
  postLikes,
  postReactions,
  profiles,
  therapySessions,
} from '@/server/db/schema'
import { buildCareProgramState } from '@/lib/care-program'
import { computeStreak } from '@/lib/achievements'

const weekMs = 7 * 24 * 60 * 60 * 1000

function dayFrom(value: unknown): string | null {
  const date = toDate(value as never)
  return date ? date.toISOString().slice(0, 10) : null
}

function dayInWindow(day: string | null, cutoff: number): day is string {
  if (!day) return false
  return new Date(`${day}T00:00:00Z`).getTime() >= cutoff
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

export async function getCareProgram(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const today = new Date().toISOString().slice(0, 10)
  const cutoff = Date.now() - weekMs

  const [
    profile,
    checkins,
    reminders,
    taken,
    sessions,
    posts,
    comments,
    reactions,
    likes,
    commentReactionRows,
    memberships,
    scores,
  ] = await Promise.all([
    ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    ctx.db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) }),
    ctx.db.query.medicationReminders.findMany({ where: eq(medicationReminders.userId, userId) }),
    ctx.db.query.medicationTakenLog.findMany({ where: eq(medicationTakenLog.userId, userId) }),
    ctx.db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    ctx.db.query.communityPosts.findMany({ where: eq(communityPosts.userId, userId) }),
    ctx.db.query.postComments.findMany({ where: eq(postComments.userId, userId) }),
    ctx.db.query.postReactions.findMany({ where: eq(postReactions.userId, userId) }),
    ctx.db.query.postLikes.findMany({ where: eq(postLikes.userId, userId) }),
    ctx.db.query.commentReactions.findMany({ where: eq(commentReactions.userId, userId) }),
    ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.userId, userId) }),
    ctx.db.query.gameScores.findMany({ where: eq(gameScores.userId, userId) }),
  ])

  const checkinDays = checkins.map((row) => String(row.day ?? '').slice(0, 10)).filter(Boolean)
  const communityDays = [
    ...posts.filter((row) => !row.isDeleted).map((row) => dayFrom(row.createdAt)),
    ...comments.filter((row) => !row.isDeleted).map((row) => dayFrom(row.createdAt)),
    ...reactions.map((row) => dayFrom(row.createdAt)),
    ...likes.map((row) => dayFrom(row.createdAt)),
    ...commentReactionRows.map((row) => dayFrom(row.createdAt)),
  ].filter((day) => dayInWindow(day, cutoff))
  const profileSignalCount = [
    Boolean(profile?.avatarUrl),
    Boolean(String(profile?.bio ?? '').trim()),
    hasItems(profile?.conditions),
    hasItems(profile?.accessNeeds),
    hasItems(profile?.interests),
    hasItems(profile?.medications),
    Boolean(profile?.therapistPersona),
  ].filter(Boolean).length

  return buildCareProgramState({
    today,
    checkinDays,
    medicationDays: taken.map((row) => String(row.day ?? '').slice(0, 10)).filter((day) => dayInWindow(day, cutoff)),
    guideDays: sessions.map((row) => dayFrom(row.startedAt)).filter((day) => dayInWindow(day, cutoff)),
    communityDays,
    gameDays: scores.map((row) => dayFrom(row.createdAt)).filter((day) => dayInWindow(day, cutoff)),
    activeMedicationCount: reminders.filter((row) => row.active).length,
    profileSignalCount,
    groupsJoined: memberships.filter((row) => row.status === 'active').length,
    checkinStreak: computeStreak(checkinDays, today),
  })
}
