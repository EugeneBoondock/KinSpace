# KinSpace on Cloudflare — setup & deployment

KinSpace runs as a Next.js (App Router) app on **Cloudflare Workers** via the
[OpenNext adapter](https://opennext.js.org/cloudflare), with:

| Concern | Cloudflare product | Binding |
|---|---|---|
| Relational data | D1 (SQLite) | `DB` |
| User media (avatars, post media) | R2 | `MEDIA` |
| Sessions, rate-limit counters, cache | KV | `KV` |
| Background jobs (deep research, digests) | Queues | `JOBS_QUEUE` |
| Scheduled jobs | Cron Triggers | — |
| Bot protection | Turnstile | — |
| Static assets | Workers Assets | `ASSETS` |

> **Do not deploy until the resources below are provisioned and the placeholder
> IDs in `wrangler.jsonc` are replaced.** Local dev works without real IDs
> (bindings are simulated locally).

## 1. Prerequisites

```bash
npm install
npx wrangler login            # authenticate the Cloudflare account
```

## 2. Provision resources (one-time)

```bash
# D1 — copy database_id into wrangler.jsonc -> d1_databases[0].database_id
npx wrangler d1 create kinspace

# KV — copy id into wrangler.jsonc -> kv_namespaces[0].id
npx wrangler kv namespace create KV

# R2
npx wrangler r2 bucket create kinspace-media

# Queues (requires a paid Workers plan)
npx wrangler queues create kinspace-jobs
npx wrangler queues create kinspace-jobs-dlq
```

After editing `wrangler.jsonc`, regenerate types: `npm run cf:typegen`.

## 3. Database migrations

Schema lives in `src/server/db/schema/*`. Generate SQL with Drizzle, apply with
Wrangler:

```bash
npm run db:generate            # drizzle-kit -> drizzle/*.sql
npm run db:migrate:local       # apply to the local D1 (dev)
npm run db:migrate             # apply to the remote D1 (prod)
```

## 4. Secrets

Local: copy `.dev.vars.example` → `.dev.vars` and fill in. Never commit it.

Deployed: set each as a Worker secret:

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PAYSTACK_SECRET_KEY
npx wrangler secret put PAYSTACK_WEBHOOK_SECRET
npx wrangler secret put RESEARCH_CRON_SECRET
```

## 5. Local development

```bash
npm run dev          # Next dev server (Node), bindings simulated via OpenNext
npm run cf:preview   # build + run in the workerd runtime (production-accurate)
```

## 6. Deploy (after confirming the above)

```bash
npm run cf:deploy
```

## Environment variable inventory

| Name | Where | Purpose |
|---|---|---|
| `AUTH_SECRET` | secret | Signs/verifies session tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | Google OAuth |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | public / secret | Turnstile bot protection |
| `OPENAI_API_KEY` | secret | AI features |
| `OPENAI_MODEL` / `OPENAI_MODEL_FULL` | var | Model ids (verify they resolve in your account) |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | var / secret | Transactional email |
| `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_WEBHOOK_SECRET` | secret / public / secret | Payments |
| `RESEARCH_CRON_SECRET` | secret | Protects the research cron endpoint |
| `NEXT_PUBLIC_APP_URL` | var | Canonical app URL |

The legacy Firebase `NEXT_PUBLIC_FIREBASE_*` vars are removed once the frontend
cutover (task 10) completes.
