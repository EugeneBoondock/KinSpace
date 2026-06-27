import { RpcError } from '@/lib/rpc-client'

const FALLBACK = 'Guide could not reply right now'
const LIMIT_MESSAGE = 'You have reached your monthly Guide limit. Upgrade or add Guide credits to ask the Guide here.'
const DUPLICATE_MESSAGE = 'This Guide has already replied to this post.'

export function guideReplyErrorToast(error: unknown): string {
  if (error instanceof RpcError && error.code === 'GUIDE_ALREADY_REPLIED') return DUPLICATE_MESSAGE
  if (error instanceof RpcError && error.code === 'PLAN_REQUIRED') return LIMIT_MESSAGE
  if (error instanceof RpcError && error.upgrade) return LIMIT_MESSAGE

  const message = error instanceof Error ? error.message.trim() : ''
  if (/already replied/i.test(message)) return DUPLICATE_MESSAGE
  if (/upgrade required/i.test(message)) return LIMIT_MESSAGE

  return FALLBACK
}
