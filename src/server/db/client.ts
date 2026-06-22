import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

/**
 * Drizzle client bound to the D1 `DB` binding for the current request.
 * Use inside route handlers, server actions, and server components.
 */
export function getDb(): Database {
  const { env } = getCloudflareContext()
  return drizzle(env.DB, { schema })
}

/**
 * Async variant for contexts evaluated outside a request (e.g. static
 * generation / build), where the Cloudflare context must be awaited.
 */
export async function getDbAsync(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true })
  return drizzle(env.DB, { schema })
}

export { schema }
