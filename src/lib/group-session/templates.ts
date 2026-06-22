/**
 * Session template registry for virtual support group sessions.
 *
 * Each template models a real support-group format so a host can pick a shape
 * that fits the room. The structure is intentionally light: a warm check-in
 * prompt to open with, plus an ordered set of named phases the host walks the
 * group through. Templates are guidance, not enforcement, the data layer only
 * tracks the three operational phases (checkin → discussion → closing).
 */

export type SessionPhaseDef = {
  id: string
  label: string
  prompt: string
}

export type SessionTemplate = {
  id: string
  label: string
  description: string
  checkinPrompt: string
  phases: SessionPhaseDef[]
}

export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: 'open',
    label: 'Open share',
    description: 'A gentle, unstructured circle. Anyone can share what is on their heart.',
    checkinPrompt: "Welcome. In a sentence or two, how are you arriving today, what's present for you right now?",
    phases: [
      { id: 'arrive', label: 'Arrive & check in', prompt: 'Take a breath together. Share how you are arriving.' },
      { id: 'share', label: 'Open sharing', prompt: 'The floor is open. Share whatever you need to, others listen without fixing.' },
      { id: 'support', label: 'Offer support', prompt: 'Reflect back what you heard. Offer encouragement, not advice unless asked.' },
      { id: 'close', label: 'Closing round', prompt: 'One word or phrase for how you are leaving the circle today.' },
    ],
  },
  {
    id: 'aa',
    label: '12-Step style',
    description: 'A 12-step inspired meeting: serenity check-in, a reading, a sharing round, and a close.',
    checkinPrompt: "Let's begin with a moment of quiet. When you're ready, share your first name and how your day has been.",
    phases: [
      { id: 'serenity', label: 'Moment of serenity', prompt: 'A shared pause and the Serenity Prayer or a moment of quiet reflection.' },
      { id: 'reading', label: 'Reading', prompt: 'Read a passage or daily reflection, then notice what it stirs up.' },
      { id: 'sharing', label: 'Sharing round', prompt: 'Share your experience, strength, and hope. No crosstalk, we listen.' },
      { id: 'closing', label: 'Closing', prompt: 'Gratitude and a reminder: keep coming back. You are not alone.' },
    ],
  },
  {
    id: 'smart',
    label: 'SMART Recovery',
    description: 'A SMART Recovery format: check-in, agenda setting, working the tools, and a pay-it-forward close.',
    checkinPrompt: 'Check in with a number 1–10 for how this week went, and one thing you want from tonight.',
    phases: [
      { id: 'checkin', label: 'Check-in', prompt: 'Rate your week and name a win or a struggle since we last met.' },
      { id: 'agenda', label: 'Agenda', prompt: 'What does the group want to work on tonight? Set a shared agenda.' },
      { id: 'tools', label: 'Work the tools', prompt: 'Apply a SMART tool, cost/benefit analysis, urge surfing, or ABCs, to a real situation.' },
      { id: 'paying-forward', label: 'Pay it forward', prompt: 'Each person names one thing they are taking away or committing to.' },
    ],
  },
  {
    id: 'nami',
    label: 'NAMI peer circle',
    description: 'A NAMI-style peer support group: introductions, ground rules, structured sharing, and a wrap.',
    checkinPrompt: 'Welcome. Share your name and, if you like, what brought you to the group today.',
    phases: [
      { id: 'intro', label: 'Introductions', prompt: 'Go around and introduce yourselves. New faces are warmly welcome.' },
      { id: 'ground-rules', label: 'Ground rules', prompt: 'Confidentiality, respect, no advice unless invited. We share the air.' },
      { id: 'sharing', label: 'Sharing', prompt: 'Take turns sharing. Speak from your own experience using "I" statements.' },
      { id: 'wrap', label: 'Wrap-up', prompt: 'Affirmations and resources. Thank everyone for showing up for each other.' },
    ],
  },
  {
    id: 'grief',
    label: 'Grief circle',
    description: 'A grief support circle: a candle-lighting check-in, remembering, mutual support, and a soft close.',
    checkinPrompt: "Light a candle in your mind for who or what you're grieving. When ready, share their name or yours.",
    phases: [
      { id: 'candle', label: 'Candle & check-in', prompt: 'We light a candle together and check in with how grief sits today.' },
      { id: 'remembering', label: 'Remembering', prompt: 'Share a memory, a name, or a feeling. There is no right way to grieve.' },
      { id: 'support', label: 'Mutual support', prompt: 'Hold space for one another. Witnessing is enough; you need not fix anything.' },
      { id: 'closing', label: 'Closing', prompt: 'A gentle goodbye. Carry the candle with you until we meet again.' },
    ],
  },
  {
    id: 'cbt',
    label: 'CBT skills group',
    description: 'A CBT-oriented group: a mood check, thought records, skills practice, and a homework set.',
    checkinPrompt: 'Name your mood right now in a word or two, and rate its intensity from 0 to 100.',
    phases: [
      { id: 'mood-check', label: 'Mood check', prompt: 'Identify and rate your current mood. Notice it without judging it.' },
      { id: 'thought-records', label: 'Thought records', prompt: 'Catch an automatic thought. What is the evidence for and against it?' },
      { id: 'skills', label: 'Skills practice', prompt: 'Practice a reframe, a coping statement, or a grounding exercise together.' },
      { id: 'homework', label: 'Homework', prompt: 'Choose one small skill to practice before the next session.' },
    ],
  },
  {
    id: 'process',
    label: 'Process group',
    description: 'An open process group: arriving, here-and-now awareness, and a reflective close.',
    checkinPrompt: 'Arrive in the room. What are you noticing in yourself as we begin together?',
    phases: [
      { id: 'arrive', label: 'Arrive', prompt: 'Settle in and notice what you bring into the room today.' },
      { id: 'here-and-now', label: 'Here and now', prompt: 'Speak to what is alive between us right now. Stay with the present moment.' },
      { id: 'reflection', label: 'Reflection', prompt: 'What did you learn about yourself or the group? Name it out loud.' },
    ],
  },
]

/** Look up a template by id, falling back to the 'open' template. */
export function getSessionTemplate(id: string): SessionTemplate {
  return SESSION_TEMPLATES.find((template) => template.id === id) ?? SESSION_TEMPLATES[0]
}
