import type { Config } from 'drizzle-kit'

// Drizzle generates SQL migrations into ./drizzle, which wrangler applies to D1
// via `wrangler d1 migrations apply kinspace` (migrations_dir: "drizzle").
export default {
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
} satisfies Config
