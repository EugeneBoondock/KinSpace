import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-bold text-[#eedfc8]/20 mb-4">404</div>
        <h1 className="text-2xl font-bold text-[#eedfc8] mb-3">Page Not Found</h1>
        <p className="text-[#eedfc8]/60 mb-6 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-primary inline-block">
          Go Home
        </Link>
      </div>
    </div>
  )
}
