import { Spinner } from '@/components/ui'

export default function Loading() {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-brand-background/60">Just a moment…</p>
      </div>
    </main>
  )
}
