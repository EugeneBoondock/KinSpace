import Link from 'next/link'
import { EmptyState, LinkButton } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="page-container flex max-w-md flex-col items-center text-center">
        <p className="mb-2 text-6xl font-bold text-brand-background/20" aria-hidden="true">
          404
        </p>
        <EmptyState
          icon={<i className="ri-compass-3-line text-4xl" aria-hidden="true" />}
          title="We couldn’t find that page"
          description="The page you’re looking for may have moved, or the link might be out of date. Let’s get you back to a familiar place."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/" leadingIcon={<i className="ri-home-4-line" aria-hidden="true" />}>
                Go home
              </LinkButton>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-brand-background/70 underline-offset-4 hover:text-brand-background hover:underline"
              >
                Open your dashboard
              </Link>
            </div>
          }
        />
      </div>
    </main>
  )
}
