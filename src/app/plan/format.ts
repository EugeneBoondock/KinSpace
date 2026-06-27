type PlanDateValue = Date | string | number | null | undefined

function toDate(value: PlanDateValue): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatPlanDateLabel(value: PlanDateValue): string {
  const date = toDate(value)
  if (!date) return 'Not set'
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatPlanQuotaLabel(remaining: number, limit: number): string {
  if (!Number.isFinite(limit)) return 'Unlimited'
  return `${remaining} of ${limit} left`
}
