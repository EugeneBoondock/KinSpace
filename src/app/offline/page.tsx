'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-[#eedfc8]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ri-wifi-off-line text-[#eedfc8] text-3xl"></i>
        </div>
        <h1 className="text-2xl font-bold text-[#eedfc8] mb-3">You&apos;re Offline</h1>
        <p className="text-[#eedfc8]/70 mb-6">
          It looks like you&apos;ve lost your internet connection. Some features may not be available.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#eedfc8] text-brand-primary px-6 py-3 rounded-full font-semibold hover:bg-[#eedfc8]/90 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
