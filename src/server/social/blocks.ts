import { and, eq, or } from 'drizzle-orm'
import type { Database } from '@/server/db/client'
import { userBlocks } from '@/server/db/schema'

/**
 * Internal block helpers (NOT in the data registry, so they're never exposed as
 * RPC methods). Used to filter feeds and gate DMs.
 */

/** Every userId in a block relationship with `userId`, either direction — used to hide content both ways. */
export async function blockedRelatedIds(db: Database, userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set()
  const rows = await db.query.userBlocks.findMany({
    where: or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)),
  })
  const set = new Set<string>()
  for (const r of rows) set.add(r.blockerId === userId ? r.blockedId : r.blockerId)
  return set
}

/** True if either user has blocked the other. */
export async function isBlockBetween(db: Database, a: string, b: string): Promise<boolean> {
  const row = await db.query.userBlocks.findFirst({
    where: or(
      and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
      and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
    ),
  })
  return Boolean(row)
}
