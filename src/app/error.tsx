'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-[#eedfc8]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ri-error-warning-line text-brand-accent1 text-3xl"></i>
        </div>
        <h1 className="text-2xl font-bold text-[#eedfc8] mb-3">Something went wrong</h1>
        <p className="text-[#eedfc8]/60 mb-6 text-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button onClick={reset} className="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  )
}
