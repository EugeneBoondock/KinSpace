'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DatabaseService } from '@/lib/database'

/**
 * Resolve a @username to its profile and redirect to the canonical
 * /profile/{userId}. This keeps @mention links working without the profile page
 * itself having to accept usernames (it operates strictly on userIds). getProfile
 * falls back to a username lookup, so this just forwards to the real profile.
 */
export default function UserByHandle({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const router = useRouter()

  useEffect(() => {
    let active = true
    const handle = decodeURIComponent(username || '').replace(/^@/, '')
    if (!handle) {
      router.replace('/community')
      return
    }
    DatabaseService.getProfile(handle)
      .then((profile: { user_id?: string; id?: string } | null) => {
        if (!active) return
        // RPC results are snake_cased: the user id arrives as user_id (id mirrors it).
        const resolvedId = profile?.user_id || profile?.id
        router.replace(resolvedId ? `/profile/${resolvedId}` : '/community')
      })
      .catch(() => {
        if (active) router.replace('/community')
      })
    return () => {
      active = false
    }
  }, [username, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-brand-ink/60">
      Finding that member…
    </div>
  )
}
