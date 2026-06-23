// Hand-maintained Cloudflare binding + env types.
//
// We intentionally do NOT use the full `wrangler types` runtime output here:
// it redefines global `fetch`/`Response`/`Request` with workerd signatures
// (e.g. `Response.json()` returns `unknown`), which clashes with the DOM lib
// that client components rely on. Importing binding types as *module* types
// (below) types `getCloudflareContext().env` without polluting browser globals.
//
// When you add a binding in wrangler.jsonc, add it here too.
import type { D1Database, KVNamespace, R2Bucket, Queue, Fetcher } from '@cloudflare/workers-types'

declare global {
  interface CloudflareEnv {
    // Bindings
    DB: D1Database
    KV: KVNamespace
    MEDIA: R2Bucket
    JOBS_QUEUE: Queue
    ASSETS: Fetcher

    // Vars
    NEXT_PUBLIC_APP_URL: string
    APP_ENV: string

    // Secrets (set via `wrangler secret put` / `.dev.vars`)
    AUTH_SECRET: string
    FIELD_ENCRYPTION_KEY?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string
    TURNSTILE_SECRET_KEY?: string
    OPENAI_API_KEY?: string
    OPENAI_MODEL?: string
    OPENAI_MODEL_FULL?: string
    EMAIL_PROVIDER?: string
    RESEND_API_KEY?: string
    BREVO_API_KEY?: string
    EMAIL_FROM?: string
    PAYSTACK_SECRET_KEY?: string
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?: string
    PAYSTACK_WEBHOOK_SECRET?: string
    PAYSTACK_PLAN_PLUS?: string
    PAYSTACK_PLAN_PRO?: string
    RESEARCH_CRON_SECRET?: string
  }

  namespace Cloudflare {
    interface Env extends CloudflareEnv {}
  }
}

export {}
