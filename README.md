# KinSpace

A warm, safe, premium healing & support platform for people living with chronic
illness, mental-health struggles, addiction recovery, grief, and the search for
treatments and community. https://www.kinspace.co.za

## Stack

- **Next.js 16** (App Router, React 19, TypeScript, Tailwind v4) — PWA.
- **Target runtime: Cloudflare** — Workers (via `@opennextjs/cloudflare`), **D1**
  (data), **R2** (media), **KV** (sessions/cache/rate-limit), **Queues**
  (background jobs), **Cron Triggers**, **Turnstile** (bot protection).
- **Auth:** custom session auth on Workers (PBKDF2 + KV/D1 sessions, Google OAuth).
- **AI:** OpenAI (therapy guide, health Q&A, deep-research summaries) with
  code-level crisis & medical-safety guardrails.
- **Payments:** Paystack (ZAR), behind a provider abstraction.

> **Migration in progress.** The app is being moved from Firebase/Vercel to the
> Cloudflare stack as a coordinated big-bang cutover. See
> [`docs/MIGRATION_STATUS.md`](docs/MIGRATION_STATUS.md) for exactly what is built
> and what remains, and [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md) for setup.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in secrets (optional for most of the UI)
npm run dev                      # Next dev server
```

Other commands:

```bash
npm run typecheck        # tsc --noEmit (quality gate)
npm run lint
npm run db:generate      # regenerate D1 migrations from Drizzle schema
npm run db:migrate:local # apply migrations to local D1
npm run cf:preview       # build + run in the Cloudflare workerd runtime
npm run cf:deploy        # deploy (only after provisioning — see docs/CLOUDFLARE.md)
```

## Project structure

```
src/
  app/                 # routes (pages, /api route handlers, server actions in app/actions)
  components/ui/        # design-system primitives (Button, Card, Input, Tabs, Modal, …)
  lib/                  # shared client+server utilities, zod schemas, crisis resources
  server/               # server-only code
    db/schema/          # Drizzle D1 schema (48 tables)
    auth/               # password/session/oauth, current-user, guards
    repos/  data/       # data access (D1)
    billing/            # tiers, entitlements, Paystack
    moderation/ privacy/ ai/   # trust & safety
    http/               # request auth + rate limiting
drizzle/                # generated D1 migrations
docs/                   # CLOUDFLARE.md, MIGRATION_STATUS.md
```

## Safety

KinSpace serves vulnerable users. AI features carry explicit "not medical advice"
framing and crisis detection; see `/crisis` for helplines and
`/community-guidelines` for community standards. Report/block/mute and a
moderation queue back the community.
