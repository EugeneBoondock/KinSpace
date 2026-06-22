'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { useToast } from './Toast'

type Direction = 'sent' | 'received'
type Status = 'idle' | 'sent' | 'received' | 'accepted' | 'declined' | 'self'

type StrandButtonProps = {
  targetUserId: string | null | undefined
  initialStatus?: Status
  initialRequestId?: string | null
  className?: string
  size?: 'sm' | 'md'
  onChanged?: (status: Status) => void
}

function labelForStatus(status: Status, direction: Direction | null): string {
  if (status === 'self') return 'This is you'
  if (status === 'accepted') return 'Stranded'
  if (status === 'sent' || (status === 'idle' && direction === 'sent')) return 'Strand pending'
  if (status === 'received') return 'Accept strand'
  if (status === 'declined') return 'Strand declined'
  return 'Send strand'
}

export default function StrandButton({
  targetUserId,
  initialStatus,
  initialRequestId,
  className = '',
  size = 'md',
  onChanged,
}: StrandButtonProps) {
  const { user } = useAuth()
  const { push: toast } = useToast()
  const [status, setStatus] = useState<Status>(initialStatus ?? 'idle')
  const [direction, setDirection] = useState<Direction | null>(null)
  const [requestId, setRequestId] = useState<string | null>(initialRequestId ?? null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!initialStatus)

  const refresh = useCallback(async () => {
    if (!user || !targetUserId) return
    if (user.userId === targetUserId) {
      setStatus('self')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const strand = (await DatabaseService.getStrandWithUser(user.userId, targetUserId)) as
        | (Record<string, unknown> & { id: string; direction: 'sent' | 'received' })
        | null

      if (!strand) {
        setStatus('idle')
        setDirection(null)
        setRequestId(null)
        return
      }

      setRequestId(strand.id)
      setDirection(strand.direction)
      const rawStatus = strand.status as string | undefined
      if (rawStatus === 'accepted') setStatus('accepted')
      else if (rawStatus === 'declined') setStatus('declined')
      else if (rawStatus === 'pending') setStatus(strand.direction === 'sent' ? 'sent' : 'received')
      else setStatus('idle')
    } catch (error) {
      console.error('Strand lookup failed:', error)
    } finally {
      setLoading(false)
    }
  }, [user, targetUserId])

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus)
      setLoading(false)
      return
    }
    void refresh()
  }, [initialStatus, refresh])

  async function handleClick() {
    if (!user || !targetUserId || busy) return
    if (status === 'self') return

    setBusy(true)
    try {
      if (status === 'idle') {
        const id = await DatabaseService.sendConnectionRequest(user.userId, targetUserId)
        setRequestId(id)
        setDirection('sent')
        setStatus('sent')
        toast('Connect strand sent', 'success')
        onChanged?.('sent')
        return
      }

      if (status === 'sent' && requestId) {
        await DatabaseService.cancelConnectionRequest(requestId)
        setRequestId(null)
        setDirection(null)
        setStatus('idle')
        toast('Strand withdrawn', 'info')
        onChanged?.('idle')
        return
      }

      if (status === 'received' && requestId) {
        await DatabaseService.updateConnectionRequest(requestId, 'accepted')
        setStatus('accepted')
        toast('Stranded', 'success')
        onChanged?.('accepted')
        return
      }
    } catch (error) {
      console.error('Strand action failed:', error)
      toast('Strand action failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sizeClass = size === 'sm' ? '!py-1.5 !px-3 text-xs' : '!py-2.5 !px-4 text-sm'
  const variant =
    status === 'accepted'
      ? 'bg-brand-accent3/20 text-brand-background hover:bg-brand-accent3/30'
      : status === 'received'
        ? 'bg-brand-accent2 text-brand-surface hover:brightness-105'
        : status === 'sent'
          ? 'bg-brand-background/8 text-brand-background/65 hover:bg-brand-background/14'
          : status === 'declined' || status === 'self'
            ? 'bg-brand-background/5 text-brand-background/40'
            : 'bg-brand-accent2/18 text-brand-background hover:bg-brand-accent2/28'

  return (
    <button
      onClick={handleClick}
      disabled={busy || loading || status === 'self' || status === 'declined' || status === 'accepted'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${sizeClass} ${variant} ${className}`}
    >
      {busy ? 'Working...' : loading ? '...' : labelForStatus(status, direction)}
    </button>
  )
}
