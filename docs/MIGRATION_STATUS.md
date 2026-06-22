# KinSpace → Cloudflare migration: status & cutover guide

This is the source of truth for the big-bang migration from Firebase/Vercel to a
Cloudflare-first stack (Workers via OpenNext, D1, R2, KV, Queues, Cron). It is
honest about what is built vs. what remains.

> **Important:** the live app still runs on **Firebase** today. Every module
> below is **additive** — it does not change runtime behaviour until the
> coordinated cutover (step C) flips auth + data + storage together. The build
> is green (`npm run typecheck`) at every step.

## A. Done & verified (typecheck-green)

**Platform foundation**
- OpenNext + wrangler config (`wrangler.jsonc`, `open-next.config.ts`, `next.config.ts` hook), typed bindings (`cloudflare-env.d.ts` — hand-maintained; do **not** regenerate with the full `wrangler types` runtime, it breaks the DOM `Response` typing), `.dev.vars.example`, npm scripts, `docs/CLOUDFLARE.md`.
- D1 schema: 48 tables in `src/server/db/schema/*`, migration `drizzle/0000_init.sql`, client `src/server/db/client.ts`, env accessor `src/server/env.ts`.

**Auth (complete)** — `src/server/auth/*`, `src/server/repos/users.ts`, `src/app/actions/auth.ts`, `src/app/api/auth/*`
- PBKDF2 password hashing (Web Crypto), session tokens hashed at rest, KV-cached + D1-backed sessions, email verification, password reset, Google OAuth, Turnstile, Resend email abstraction, request-scoped `getCurrentUser()` / `requireUser()` / `requireRole()`.

**Route protection (complete)** — `src/middleware.ts` (optimistic cookie gate; authoritative checks in server components).

**Security primitives** — `src/server/http/{auth,rate-limit}.ts` (session-derived userId, KV rate limiter). AI-safety guardrails `src/server/ai/safety.ts` (crisis detection, medical disclaimer) + `src/lib/crisis-resources.ts`.

**Monetisation (server complete + pricing UI)** — `src/server/billing/*` (tiers/entitlements, usage metering with atomic `checkAndConsume`, Paystack adapter, subscription lifecycle), webhook `src/app/api/paystack/webhook/route.ts`, actions `src/app/actions/billing.ts`, public `/pricing` page.

**Moderation (server complete)** — `src/server/moderation/repo.ts` (reports, blocks, mutes, takedown, roles, suspend), actions `src/app/actions/moderation.ts`.

**Privacy/compliance (server complete)** — `src/server/privacy/data.ts` (full export + erasure across all tables), actions `src/app/actions/account.ts`.

**Design system** — `src/components/ui/*` (Button, Card, Input/Field, Badge, Tabs, Modal, Avatar, feedback) + `src/lib/cn.ts`.

**Public pages** — `/pricing`, `/crisis`, `/community-guidelines`.

## B. Remaining work (the integration)

1. **D1 data layer (task 4)** — port the ~80 `DatabaseService` methods (currently Firestore in `src/lib/database.ts`) to D1 repositories under `src/server/data/*`. Fix N+1 with joins, add pagination, push filters into SQL.
2. **Secure API cutover (task 7)** — rewrite the AI routes (`/api/therapy/chat`, `/api/ask/answer`, `/api/research/*`) to derive `userId` from the session (kills the IDOR), enforce `checkAndConsume` quotas + `rateLimit`, and read/write D1 instead of `firebase-admin`.
3. **R2 media (task 8)** — replace Firebase Storage with an R2 upload route + client.
4. **Queues + Cron (task 9)** — move deep-research off the request path; wire `triggers.crons` to handlers.
5. **Frontend flip (task 10)** — replace `src/lib/{database,auth,firebase}.ts` with client adapters calling the new server actions/RPC; make `layout.tsx` server-resolve the user and pass it to a thin `AuthProvider`; remove `firebase` + `firebase-admin`.
6. **Tools (task 16)** — journal, symptom/treatment trackers, medication reminders, saved resources, support circles UI (schema + entitlements already exist).
7. **Redesign + SEO (tasks 13–14)** — apply the design system across all pages; `generateMetadata`, `robots.txt`, OG images, referral system, digest, personalised dashboard, onboarding quiz.
8. **Admin/settings UI** — moderation dashboard, account export/delete buttons, billing page (server logic already exists).
9. **Tests + docs (task 17)** — Vitest + Playwright; finish the doc set.

## C. Cutover sequence (do in order, keep `npm run typecheck` green)

1. Provision Cloudflare resources + fill `wrangler.jsonc` IDs and `.dev.vars` (see `docs/CLOUDFLARE.md`).
2. `npm run db:migrate:local` to create the schema in local D1.
3. Build the D1 data layer (B1) and a one-time **Firestore→D1 export/import** script for existing production data.
4. Flip auth + data + storage (B5) in one branch; delete Firebase.
5. `npm run cf:preview` to validate in the workerd runtime; run E2E.
6. Provision prod resources, `npm run db:migrate`, set secrets, `npm run cf:deploy`.

## D. What the owner must provide before deploy
Cloudflare account + provisioned D1/KV/R2/Queues IDs · `AUTH_SECRET` · Google OAuth creds · Turnstile keys · Resend (or Cloudflare Email) key · Paystack secret/public/webhook keys + plan codes · confirmation that the OpenAI model ids resolve.
