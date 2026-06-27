import { eq } from 'drizzle-orm'
import type { Database } from '@/server/db/client'
import { profiles, users } from '@/server/db/schema'
import { getPersona } from '@/lib/therapy-config'

export function guidePersonaUserId(personaId: string | null | undefined): string {
  return `guide-${getPersona(personaId).id}`
}

export async function ensureGuidePersonaUser(db: Database, personaId: string | null | undefined) {
  const persona = getPersona(personaId)
  const userId = guidePersonaUserId(persona.id)
  const username = `guide-${persona.id}`

  const existingUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!existingUser) {
    await db
      .insert(users)
      .values({
        id: userId,
        email: `${username}@kinspace.local`,
        emailVerified: true,
        role: 'user',
        status: 'active',
      })
      .catch(() => undefined)
  }

  const existingProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
  if (!existingProfile) {
    await db
      .insert(profiles)
      .values({
        userId,
        username,
        fullName: `${persona.name} Guide`,
        isAnonymous: false,
        avatarUrl: persona.avatarSrc,
        bio: 'KinSpace Guide persona.',
        onboardingComplete: true,
        visibility: 'community',
      })
      .catch(() => undefined)
  }

  return { userId, persona }
}
