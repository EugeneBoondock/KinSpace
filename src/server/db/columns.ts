import { integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Shared column factories for D1/SQLite tables.
 * Each call returns a fresh Drizzle column builder, so they can be reused
 * across every table definition without sharing state.
 */

/** Text primary key, app-generated with crypto.randomUUID() at insert time. */
export const pk = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

/** Unix-epoch-millis timestamp, defaults to row creation time. */
export const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

export const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

/** A nullable timestamp column with the given DB name. */
export const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })

/** Boolean stored as 0/1. */
export const bool = (name: string) => integer(name, { mode: 'boolean' })

/** JSON column typed to T (stored as TEXT). */
export const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>()
