'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TherapistRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/therapy')
  }, [router])

  return (
    <div className="page-shell">
      <div className="page-container flex min-h-[60vh] items-center justify-center">
        <div className="card text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-[#D19A58]" />
          <p className="mt-3 text-sm text-[#eedfc8]/60">Opening your guided support room...</p>
        </div>
      </div>
    </div>
  )
}
