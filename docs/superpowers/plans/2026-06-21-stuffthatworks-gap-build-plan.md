# StuffThatWorks Gap Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the highest-value product gaps between KinSpace and StuffThatWorks while keeping privacy, mental-health safety, and production stability intact.

**Architecture:** Build on KinSpace’s existing condition reports, condition studies, comments, Ask, timeline, groups, and profiles. Ship one testable slice at a time, with privacy-safe defaults before richer member-facing report pages.

**Tech Stack:** Next.js App Router, React, Cloudflare Workers via OpenNext, D1 via Drizzle, Playwright, `tsx --test`.

---

## Gap Summary

StuffThatWorks has a strong patient-reported data loop: structured condition surveys, treatment effectiveness rankings, side-effect trends, member report search, similar-member views, condition maps, research questions, health timelines, and AI search over patient data.

KinSpace already has:

- Structured condition reports via `/contribute`.
- Condition study rollups for treatments, symptoms, triggers, tests, side effects, and co-existing conditions.
- Similar-cohort study mode.
- Ask, community, groups, therapy, resources, timeline, medications, and people discovery.

The highest-value gaps are:

1. Search member reports by treatment, symptom, side effect, trigger, or note text.
2. Treatment detail pages that show reported effectiveness, side effects, and related conditions.
3. Condition research questions with voting and member answers.
4. Report editing, completion state, and consent for public report visibility.
5. Similar-member map and people search with privacy controls.
6. Timeline events tied to treatments, side effects, symptoms, and wearable imports.
7. AI search over structured KinSpace data with clear source labels.
8. Confidence thresholds and sample-size labels on all condition study outputs.

---

## Feature Slice 1: Privacy-Safe Member Report Search

**Files:**

- Modify: `src/server/data/health.ts`
- Modify: `src/app/conditions/[slug]/page.tsx`
- Modify: `src/app/games/page.tsx`
- Modify: `qa/games-catalog.spec.ts`
- Create: `src/server/data/health-report-search.test.ts`

**Behavior:**

- Add `searchConditionReports(conditionSlug, filters)` to query condition reports for one condition.
- Allow search by free text, treatment, symptom, side effect, or trigger.
- Return anonymized structured reports only.
- Do not return profile identity or raw note text.
- Show a search panel on the condition page.
- Add quick filter chips from the condition study.
- Fix the games card button label from `Open live room` to `Open room`.

**Verification:**

- `npx tsx --test src/server/data/health-report-search.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npx playwright test qa/games-catalog.spec.ts --reporter=list`
- Production browser check for `/conditions/anxiety` report search using temporary QA data, then cleanup.

**Status:** Shipped and verified in production on 2026-06-21.

---

## Feature Slice 2: Treatment Evidence Pages

**Files:**

- Modify: `src/app/treatments/[slug]/page.tsx`
- Modify: `src/server/data/health.ts`
- Create: `src/server/data/treatment-evidence.test.ts`

**Behavior:**

- Show treatment effectiveness across conditions.
- Show side effects reported for that treatment.
- Link back to condition studies and matching reports.
- Add sample-size labels and “not medical advice” copy.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 3: Condition Research Questions

**Files:**

- Modify: `src/server/db/schema/health.ts`
- Add D1 migration.
- Modify: `src/server/data/health.ts`
- Modify: `src/app/conditions/[slug]/page.tsx`
- Create: tests for questions, voting, and answer counts.

**Behavior:**

- Members can ask condition-specific research questions.
- Members can vote on questions.
- Reports can answer structured poll-style questions later.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 4: Report Visibility and Editing

**Files:**

- Modify: `src/server/db/schema/health.ts`
- Add D1 migration.
- Modify: `src/app/contribute/page.tsx`
- Modify: `src/server/data/health.ts`

**Behavior:**

- Members can edit their report.
- Members can choose whether their anonymized report is visible in search.
- Default remains aggregated-only.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 5: Similar Member Discovery

**Files:**

- Modify: `src/server/data/profiles.ts`
- Modify: `src/app/people-like-you/page.tsx`
- Create: tests for privacy and filtering.

**Behavior:**

- Search people by shared condition, symptom, treatment, age band, and location roughness.
- Never expose hidden health fields.
- Require opt-in before message prompts appear.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 6: Timeline Data Connections

**Files:**

- Modify: `src/server/db/schema/timeline.ts`
- Modify: `src/server/data/timeline.ts`
- Modify: `src/app/timeline/page.tsx`

**Behavior:**

- Timeline entries can be typed as symptom, treatment, side effect, mood, medication, or life event.
- Condition pages can show anonymized trend summaries.

**Implementation note:** Built on the existing wellness log schema rather than a separate timeline table.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 7: AI Data Search

**Files:**

- Modify: `src/lib/ai/ask.ts`
- Modify: `src/app/ask/page.tsx`
- Add prompt tests.

**Behavior:**

- Ask can answer from KinSpace structured data with explicit source labels.
- It must never present patient reports as clinical proof.
- It must return safety guidance for crisis or medical-risk prompts.

**Status:** Shipped and verified in production on 2026-06-22.

---

## Feature Slice 8: Confidence Labels

**Files:**

- Modify: `src/server/data/health.ts`
- Modify: `src/app/conditions/[slug]/page.tsx`
- Add tests for sample-size bands.

**Behavior:**

- Show report count and confidence band on every chart and ranked list.
- Keep low-sample outputs visible but clearly marked as early.

**Status:** Shipped and verified in production on 2026-06-22.
