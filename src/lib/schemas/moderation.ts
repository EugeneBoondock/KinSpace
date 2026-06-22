import { z } from 'zod'

export const reportTargetTypes = ['post', 'comment', 'user', 'message', 'question', 'answer'] as const
export const reportReasons = [
  'harassment',
  'spam',
  'self_harm',
  'misinformation',
  'nsfw',
  'impersonation',
  'other',
] as const

export const reportSchema = z.object({
  targetType: z.enum(reportTargetTypes),
  targetId: z.string().min(1).max(120),
  targetOwnerId: z.string().max(120).optional(),
  reason: z.enum(reportReasons),
  detail: z.string().max(1000).optional(),
})
export type ReportInput = z.infer<typeof reportSchema>

export const blockSchema = z.object({ targetUserId: z.string().min(1).max(120) })
export const muteTopicSchema = z.object({ topic: z.string().min(1).max(60) })
