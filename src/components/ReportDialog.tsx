'use client'

import { useState } from 'react'
import { reportAction } from '@/app/actions/moderation'
import { reportReasons } from '@/lib/schemas/moderation'
import { useToast } from '@/components/Toast'

const REASON_LABELS: Record<(typeof reportReasons)[number], string> = {
  harassment: 'Harassment or bullying',
  spam: 'Spam or a scam',
  self_harm: 'Self-harm or someone at risk',
  misinformation: 'Harmful misinformation',
  nsfw: 'Explicit or graphic content',
  impersonation: 'Impersonation',
  other: 'Something else',
}

type ReportTargetType = 'post' | 'comment' | 'user' | 'message'

type ReportDialogProps = {
  targetType: ReportTargetType
  targetId: string
  targetOwnerId?: string | null
  /** Render an icon-only trigger (for tight action rows). */
  compact?: boolean
  className?: string
}

const TARGET_NOUN: Record<ReportTargetType, string> = {
  post: 'post',
  comment: 'comment',
  user: 'person',
  message: 'message',
}

/**
 * Self-contained "Report" trigger + modal. Submits to the moderation server
 * action (reportAction); reports are private and reviewed by the team.
 */
export default function ReportDialog({ targetType, targetId, targetOwnerId, compact, className }: ReportDialogProps) {
  const { push: toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof reportReasons)[number] | ''>('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function close() {
    setOpen(false)
    setReason('')
    setDetail('')
  }

  async function submit() {
    if (!reason) {
      toast('Please choose a reason.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const result = await reportAction({
        targetType,
        targetId,
        targetOwnerId: targetOwnerId ?? undefined,
        reason,
        detail: detail.trim() || undefined,
      })
      if (result.ok) {
        toast('Thanks — our team will review this.', 'success')
        close()
      } else {
        toast(result.error || 'Could not send the report.', 'error')
      }
    } catch {
      toast('Could not send the report.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-brand-background/45 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1'
        }
        aria-label={`Report this ${TARGET_NOUN[targetType]}`}
        title={`Report this ${TARGET_NOUN[targetType]}`}
      >
        <i className="ri-flag-line" aria-hidden="true" />
        {!compact && <span className="text-sm">Report</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Report this ${TARGET_NOUN[targetType]}`}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-brand-background/15 bg-brand-dark p-5 text-brand-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Report this {TARGET_NOUN[targetType]}</h3>
                <p className="mt-1 text-sm text-brand-background/55">
                  Reports are private. Our team reviews every one.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-background/50 transition-colors hover:bg-brand-background/10 hover:text-brand-background"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {reportReasons.map((value) => {
                const active = reason === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReason(value)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? 'border-brand-accent2/50 bg-brand-accent2/15 text-brand-background'
                        : 'border-brand-background/12 text-brand-background/75 hover:bg-brand-background/8'
                    }`}
                  >
                    <i
                      className={active ? 'ri-radio-button-line text-brand-accent2' : 'ri-checkbox-blank-circle-line text-brand-background/35'}
                      aria-hidden="true"
                    />
                    {REASON_LABELS[value]}
                  </button>
                )
              })}
            </div>

            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Add any details (optional)"
              rows={3}
              maxLength={1000}
              className="mt-3 w-full resize-none rounded-xl border border-brand-background/15 bg-brand-background/[0.06] px-3 py-2 text-sm text-brand-background placeholder:text-brand-background/35 focus:border-brand-accent2/50 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full px-4 py-2 text-sm font-medium text-brand-background/65 transition-colors hover:bg-brand-background/8"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !reason}
                className="rounded-full bg-brand-accent1 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
