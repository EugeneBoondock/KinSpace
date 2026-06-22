import assert from 'node:assert/strict'
import test from 'node:test'
import { buildResearchQuestionSummaries } from './health'

const questions = [
  {
    id: 'question-a',
    conditionSlug: 'anxiety',
    userId: 'user-a',
    question: 'Which breathing plans help panic attacks fastest?',
    detail: 'Looking for member-reported patterns.',
    status: 'open',
    isAnonymous: false,
    votesCount: 1,
    answersCount: 0,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    id: 'question-b',
    conditionSlug: 'anxiety',
    userId: 'user-b',
    question: 'Do morning routines change anxiety spikes?',
    detail: '',
    status: 'open',
    isAnonymous: true,
    votesCount: 0,
    answersCount: 0,
    createdAt: new Date('2026-03-02T00:00:00Z'),
    updatedAt: new Date('2026-03-02T00:00:00Z'),
  },
]

const votes = [
  { questionId: 'question-a', userId: 'viewer' },
  { questionId: 'question-a', userId: 'user-c' },
  { questionId: 'question-b', userId: 'user-d' },
]

const answers = [
  {
    id: 'answer-a',
    questionId: 'question-a',
    userId: 'user-c',
    answer: 'Slow breathing helped when I started before the first peak.',
    isAnonymous: true,
    createdAt: new Date('2026-03-04T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'answer-b',
    questionId: 'question-b',
    userId: 'user-d',
    answer: 'Morning sunlight helped my spikes feel shorter.',
    isAnonymous: false,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
  },
]

test('builds research question summaries with vote state and answer counts', () => {
  const summaries = buildResearchQuestionSummaries(questions, answers, votes, 'viewer')

  assert.equal(summaries[0].id, 'question-a')
  assert.equal(summaries[0].votes_count, 2)
  assert.equal(summaries[0].answers_count, 1)
  assert.equal(summaries[0].has_voted, true)
  assert.equal(summaries[0].answers[0].answer.includes('Slow breathing'), true)

  assert.equal(summaries[1].id, 'question-b')
  assert.equal(summaries[1].votes_count, 1)
  assert.equal(summaries[1].has_voted, false)
})

test('sorts research questions by votes, answers, then recency', () => {
  const summaries = buildResearchQuestionSummaries(
    questions.map((question) =>
      question.id === 'question-b' ? { ...question, votesCount: 2, answersCount: 3 } : question,
    ),
    [],
    [],
    null,
  )

  assert.deepEqual(
    summaries.map((question) => question.id),
    ['question-b', 'question-a'],
  )
})
