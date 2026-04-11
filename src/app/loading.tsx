export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-[#eedfc8]/20 border-t-[#eedfc8] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#eedfc8]/60 text-sm">Loading...</p>
      </div>
    </div>
  )
}
