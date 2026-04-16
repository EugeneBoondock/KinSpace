'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { useToast } from './Toast'

type Direction = 'sent' | 'received'
type Status = 'idle' | 'sent' | 'received' | 'accepted' | 'declined' | 'self'

type StrandButtonProps = {
  targetUserId: string | null | undefined
  /** Optional: skip the initial status lookup if you've already resolved it. */
  initialStatus?: Status
  initialRequestId?: string | null
  className?: string
  size?: 'sm' | 'md'
  /** Called after an action completes so a parent list can refresh counts. */
  onChanged?: (status: Status) => void
}

function labelForStatus(status: Status, direction: Direction | null): string {
  if (status === 'self') return 'This is you'
  if (status === 'accepted') return '🧬 Stranded'
  if (status === 'sent' || (status === 'idle' && direction === 'sent')) return 'Strand pending'
  if (status === 'received') return 'Accept strand'
  if (status === 'declined') return 'Strand declined'
  return '🧬 Send strand'
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
        toast('Connect Strand sent 🧬', 'success')
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
        toast('Stranded 🧬', 'success')
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
      ? 'bg-[#6B8A83]/25 text-[#6B8A83] hover:bg-[#6B8A83]/35'
      : status === 'received'
        ? 'bg-[#D19A58] text-[#2A4A42] hover:bg-[#D19A58]/90'
        : status === 'sent'
          ? 'bg-[#eedfc8]/8 text-[#eedfc8]/65 hover:bg-[#eedfc8]/14'
          : status === 'declined' || status === 'self'
            ? 'bg-[#eedfc8]/5 text-[#eedfc8]/40'
            : 'bg-[#D19A58]/15 text-[#D19A58] hover:bg-[#D19A58]/25'

  return (
    <button
      onClick={handleClick}
      disabled={busy || loading || status === 'self' || status === 'declined' || status === 'accepted'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${sizeClass} ${variant} ${className}`}
    >
      {busy ? 'Working…' : loading ? '…' : labelForStatus(status, direction)}
    </button>
  )
}
