import { eq, or } from 'drizzle-orm'
import { getDb } from '../db/client'
import {
  users,
  profiles,
  sessions,
  communityPosts,
  postLikes,
  postReactions,
  postComments,
  chatMessages,
  groupMembers,
  activityMembers,
  connectionRequests,
  angels,
  angelSoulRelationships,
  mentors,
  supportCircles,
  circleMembers,
  experiences,
  experienceVotes,
  askQuestions,
  askAnswers,
  askAnswerVotes,
  researchRequests,
  resourceContributions,
  resourceContributionVotes,
  savedResources,
  games,
  gamePlayers,
  moodCheckins,
  therapySessions,
  journalEntries,
  symptomLogs,
  treatmentLogs,
  medicationReminders,
  subscriptions,
  usageCounters,
  reports,
  userBlocks,
  mutedTopics,
  notifications,
  referrals,
} from '../db/schema'

/** Assembles a full export of a user's data (POPIA/GDPR portability). */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const db = getDb()
  const byUser = <T>(rows: T): T => rows
  const [
    account,
    profile,
    posts,
    comments,
    asks,
    answers,
    userExperiences,
    moods,
    therapy,
    journal,
    symptoms,
    treatments,
    meds,
    memberships,
    connections,
    saved,
    subscription,
  ] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    db.query.communityPosts.findMany({ where: eq(communityPosts.userId, userId) }),
    db.query.postComments.findMany({ where: eq(postComments.userId, userId) }),
    db.query.askQuestions.findMany({ where: eq(askQuestions.userId, userId) }),
    db.query.askAnswers.findMany({ where: eq(askAnswers.userId, userId) }),
    db.query.experiences.findMany({ where: eq(experiences.userId, userId) }),
    db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) }),
    db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    db.query.journalEntries.findMany({ where: eq(journalEntries.userId, userId) }),
    db.query.symptomLogs.findMany({ where: eq(symptomLogs.userId, userId) }),
    db.query.treatmentLogs.findMany({ where: eq(treatmentLogs.userId, userId) }),
    db.query.medicationReminders.findMany({ where: eq(medicationReminders.userId, userId) }),
    db.query.groupMembers.findMany({ where: eq(groupMembers.userId, userId) }),
    db.query.connectionRequests.findMany({
      where: or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.targetUserId, userId)),
    }),
    db.query.savedResources.findMany({ where: eq(savedResources.userId, userId) }),
    db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) }),
  ])

  return byUser({
    exportedAt: new Date().toISOString(),
    account: account ? { id: account.id, email: account.email, role: account.role, createdAt: account.createdAt } : null,
    profile,
    posts,
    comments,
    askQuestions: asks,
    askAnswers: answers,
    experiences: userExperiences,
    moodCheckins: moods,
    therapySessions: therapy,
    journalEntries: journal,
    symptomLogs: symptoms,
    treatmentLogs: treatments,
    medicationReminders: meds,
    groupMemberships: memberships,
    connections,
    savedResources: saved,
    subscription,
  })
}

/**
 * Hard-deletes all of a user's data across every table (POPIA/GDPR erasure).
 * Done explicitly per-table so it does not depend on FK cascade being enabled.
 */
export async function deleteUserData(userId: string): Promise<void> {
  const db = getDb()
  // Order: dependents first, owner row last.
  await db.delete(sessions).where(eq(sessions.userId, userId))
  await db.delete(postLikes).where(eq(postLikes.userId, userId))
  await db.delete(postReactions).where(eq(postReactions.userId, userId))
  await db.delete(postComments).where(eq(postComments.userId, userId))
  await db.delete(communityPosts).where(eq(communityPosts.userId, userId))
  await db.delete(chatMessages).where(eq(chatMessages.senderId, userId))
  await db.delete(groupMembers).where(eq(groupMembers.userId, userId))
  await db.delete(activityMembers).where(eq(activityMembers.userId, userId))
  await db
    .delete(connectionRequests)
    .where(or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.targetUserId, userId)))
  await db.delete(angelSoulRelationships).where(eq(angelSoulRelationships.soulId, userId))
  await db.delete(angels).where(eq(angels.userId, userId))
  await db.delete(mentors).where(eq(mentors.userId, userId))
  await db.delete(circleMembers).where(eq(circleMembers.userId, userId))
  await db.delete(supportCircles).where(eq(supportCircles.ownerId, userId))
  await db.delete(experienceVotes).where(eq(experienceVotes.userId, userId))
  await db.delete(experiences).where(eq(experiences.userId, userId))
  await db.delete(askAnswerVotes).where(eq(askAnswerVotes.userId, userId))
  await db.delete(askAnswers).where(eq(askAnswers.userId, userId))
  await db.delete(askQuestions).where(eq(askQuestions.userId, userId))
  await db.delete(researchRequests).where(eq(researchRequests.userId, userId))
  await db.delete(resourceContributionVotes).where(eq(resourceContributionVotes.userId, userId))
  await db.delete(resourceContributions).where(eq(resourceContributions.userId, userId))
  await db.delete(savedResources).where(eq(savedResources.userId, userId))
  await db.delete(gamePlayers).where(eq(gamePlayers.userId, userId))
  await db.delete(games).where(eq(games.hostId, userId))
  await db.delete(moodCheckins).where(eq(moodCheckins.userId, userId))
  await db.delete(therapySessions).where(eq(therapySessions.userId, userId))
  await db.delete(journalEntries).where(eq(journalEntries.userId, userId))
  await db.delete(symptomLogs).where(eq(symptomLogs.userId, userId))
  await db.delete(treatmentLogs).where(eq(treatmentLogs.userId, userId))
  await db.delete(medicationReminders).where(eq(medicationReminders.userId, userId))
  await db.delete(usageCounters).where(eq(usageCounters.userId, userId))
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId))
  await db.delete(reports).where(eq(reports.reporterId, userId))
  await db.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)))
  await db.delete(mutedTopics).where(eq(mutedTopics.userId, userId))
  await db.delete(notifications).where(eq(notifications.userId, userId))
  await db.delete(referrals).where(eq(referrals.createdBy, userId))
  await db.delete(profiles).where(eq(profiles.userId, userId))
  await db.delete(users).where(eq(users.id, userId))
}
