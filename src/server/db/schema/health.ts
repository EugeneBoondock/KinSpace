import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, bool, json } from '../columns'
import { users } from './identity'

// ── Conditions / treatments knowledge base (StuffThatWorks-style) ───────────

export const conditions = sqliteTable('conditions', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  aliases: json<string[]>('aliases').default([]),
  description: text('description'),
  category: text('category'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const treatments = sqliteTable('treatments', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind'),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const conditionTreatments = sqliteTable(
  'condition_treatments',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    treatmentSlug: text('treatment_slug').notNull(),
    effectivenessAvg: real('effectiveness_avg').notNull().default(0),
    effectivenessCount: integer('effectiveness_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('cond_treat_uniq').on(t.conditionSlug, t.treatmentSlug)],
)

export const experiences = sqliteTable(
  'experiences',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conditionSlug: text('condition_slug').notNull(),
    treatmentSlug: text('treatment_slug'),
    rating: integer('rating'),
    content: text('content').notNull().default(''),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    upvotes: integer('upvotes').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('experiences_condition_idx').on(t.conditionSlug)],
)

export const experienceVotes = sqliteTable(
  'experience_votes',
  {
    id: pk(),
    experienceId: text('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: integer('value').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('experience_votes_uniq').on(t.experienceId, t.userId)],
)

export const symptoms = sqliteTable('symptoms', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  createdAt: createdAt(),
})

export const conditionSymptoms = sqliteTable(
  'condition_symptoms',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    symptomSlug: text('symptom_slug').notNull(),
    prevalence: real('prevalence'),
  },
  (t) => [uniqueIndex('cond_symptom_uniq').on(t.conditionSlug, t.symptomSlug)],
)

export const triggers = sqliteTable('triggers', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  createdAt: createdAt(),
})

export const conditionTriggers = sqliteTable(
  'condition_triggers',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    triggerSlug: text('trigger_slug').notNull(),
    prevalence: real('prevalence'),
  },
  (t) => [uniqueIndex('cond_trigger_uniq').on(t.conditionSlug, t.triggerSlug)],
)

export const tests = sqliteTable('tests', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind'), // 'blood' | 'imaging' | 'genetic' | 'functional' | ...
  createdAt: createdAt(),
})

export const conditionTests = sqliteTable(
  'condition_tests',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    testSlug: text('test_slug').notNull(),
    prevalence: real('prevalence'),
  },
  (t) => [uniqueIndex('cond_test_uniq').on(t.conditionSlug, t.testSlug)],
)

// One structured contribution per member per condition — the survey record that
// feeds the aggregated "study" (symptoms, triggers, treatments + effectiveness +
// side effects, comorbidities, tests, age of onset). Re-submitting upserts.
type ReportTreatment = { slug: string; name?: string; effectiveness: number | null; side_effects: string[] }

export const conditionReports = sqliteTable(
  'condition_reports',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conditionSlug: text('condition_slug').notNull(),
    ageOfOnset: integer('age_of_onset'),
    symptoms: json<string[]>('symptoms').default([]),
    triggers: json<string[]>('triggers').default([]),
    comorbidities: json<string[]>('comorbidities').default([]),
    tests: json<string[]>('tests').default([]),
    treatments: json<ReportTreatment[]>('treatments').default([]),
    note: text('note'),
    isSearchVisible: bool('is_search_visible').notNull().default(false),
    completionState: text('completion_state').notNull().default('complete'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('condition_reports_uniq').on(t.userId, t.conditionSlug),
    index('condition_reports_condition_idx').on(t.conditionSlug),
  ],
)

export const conditionResearchQuestions = sqliteTable(
  'condition_research_questions',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    detail: text('detail').notNull().default(''),
    status: text('status').notNull().default('open'),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    votesCount: integer('votes_count').notNull().default(0),
    answersCount: integer('answers_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('condition_research_questions_condition_idx').on(t.conditionSlug),
    index('condition_research_questions_status_idx').on(t.status),
  ],
)

export const conditionResearchQuestionVotes = sqliteTable(
  'condition_research_question_votes',
  {
    id: pk(),
    questionId: text('question_id')
      .notNull()
      .references(() => conditionResearchQuestions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('condition_research_question_votes_uniq').on(t.questionId, t.userId)],
)

export const conditionResearchQuestionAnswers = sqliteTable(
  'condition_research_question_answers',
  {
    id: pk(),
    questionId: text('question_id')
      .notNull()
      .references(() => conditionResearchQuestions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('condition_research_question_answers_question_idx').on(t.questionId)],
)

// Threaded community discussion attached to a condition (questions, tips, support).
export const conditionComments = sqliteTable(
  'condition_comments',
  {
    id: pk(),
    conditionSlug: text('condition_slug').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    upvotes: integer('upvotes').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('condition_comments_idx').on(t.conditionSlug)],
)

// ── Ask (symptom + health questions, with AI synthesis) ─────────────────────

type AskSource = { index: number; title: string; url: string; domain: string }
type RedditThread = { title: string; url: string; subreddit: string; snippet: string }

export const askQuestions = sqliteTable(
  'ask_questions',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    body: text('body').notNull().default(''),
    scope: text('scope').notNull().default('public'),
    groupId: text('group_id'),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    relatedConditions: json<string[]>('related_conditions').default([]),
    tags: json<string[]>('tags').default([]),
    aiAnswer: text('ai_answer'),
    aiPlainSummary: text('ai_plain_summary'),
    aiRedFlags: json<string[]>('ai_red_flags').default([]),
    aiSelfCare: json<string[]>('ai_self_care').default([]),
    aiSeeProfessional: json<string[]>('ai_see_professional').default([]),
    aiSources: json<AskSource[]>('ai_sources').default([]),
    aiRedditThreads: json<RedditThread[]>('ai_reddit_threads').default([]),
    answersCount: integer('answers_count').notNull().default(0),
    upvotes: integer('upvotes').notNull().default(0),
    status: text('status').notNull().default('pending-answer'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('ask_q_scope_idx').on(t.scope), index('ask_q_user_idx').on(t.userId)],
)

export const askAnswers = sqliteTable(
  'ask_answers',
  {
    id: pk(),
    questionId: text('question_id')
      .notNull()
      .references(() => askQuestions.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    upvotes: integer('upvotes').notNull().default(0),
    isAi: bool('is_ai').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('ask_a_question_idx').on(t.questionId)],
)

export const askAnswerVotes = sqliteTable(
  'ask_answer_votes',
  {
    id: pk(),
    answerId: text('answer_id')
      .notNull()
      .references(() => askAnswers.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ask_answer_votes_uniq').on(t.answerId, t.userId)],
)
