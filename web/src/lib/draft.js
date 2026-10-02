// The request draft the wizard edits, and the pure functions derived from it.

import { ORACLES } from './oracles'

let nextId = 0
const uid = () => `id${++nextId}`

export const QUESTION_TYPES = ['choice', 'score', 'yesno']

export const DEFAULT_MIN_CONFIDENCE = 0.8

export function newOption(label = '', description = '') {
  return { id: uid(), label, description }
}

export function newLevel(text = '') {
  return { id: uid(), text }
}

/** A question keeps every type's fields so switching type does not lose what was typed. */
export function newQuestion(type = 'choice', name = '') {
  return {
    id: uid(),
    name,
    type,
    instructions: '',
    options: [newOption(), newOption()],
    levels: [newLevel(), newLevel(), newLevel()],
    yes: '',
    no: '',
  }
}

export function emptyDraft() {
  return {
    mode: 'custom', // 'preset' | 'custom' | 'oracle'
    presetName: null,
    oracleName: null, // 'yesno' | '8ball' in oracle mode
    presetQuestions: [], // names, in preset order
    presetSubset: [], // checked names
    text: '', // the question in oracle mode
    questions: [],
    // Kept as is in oracle mode (never sent there), so going back to custom restores it.
    minConfidence: DEFAULT_MIN_CONFIDENCE, // low-confidence flag on by default; null = off
  }
}

/** First free name of the form q1, q2, ... */
export function freeName(questions) {
  const taken = new Set(questions.map((q) => q.name))
  let i = 1
  while (taken.has(`q${i}`)) i++
  return `q${i}`
}

/** Custom questions from a `questions` object in the format /v1/decide accepts. */
export function questionsFromApi(questions) {
  return Object.entries(questions).map(([name, def]) => {
    const q = newQuestion(def.type, name)
    q.instructions = def.instructions ?? ''
    if (def.type === 'choice') {
      q.options = Object.entries(def.criteria).map(([label, description]) => newOption(label, description))
    } else if (def.type === 'score') {
      q.levels = def.criteria.map((text) => newLevel(text))
    } else if (def.criteria) {
      q.yes = def.criteria.yes ?? ''
      q.no = def.criteria.no ?? ''
    }
    return q
  })
}

/** Custom draft from a /v1/decide body. */
export function draftFromBody(body) {
  return {
    ...emptyDraft(),
    mode: 'custom',
    text: body.text ?? '',
    questions: questionsFromApi(body.questions ?? {}),
    minConfidence: body.min_confidence ?? null,
  }
}

export function questionToApi(q) {
  const def = { type: q.type, instructions: q.instructions }
  if (q.type === 'choice') {
    def.criteria = Object.fromEntries(q.options.map((o) => [o.label, o.description]))
  } else if (q.type === 'score') {
    def.criteria = q.levels.map((l) => l.text)
  } else if (q.yes || q.no) {
    def.criteria = { yes: q.yes, no: q.no }
  }
  return def
}

/** The exact request the wizard sends: the single source for preview, send, curl and payload tab. */
export function buildRequest(draft) {
  if (draft.mode === 'oracle') {
    return { method: 'POST', path: `/v1/oracle/${draft.oracleName}`, body: { question: draft.text } }
  }
  const body = { text: draft.text }
  let path
  if (draft.mode === 'preset') {
    path = `/v1/presets/${draft.presetName}`
    const subset = draft.presetQuestions.filter((n) => draft.presetSubset.includes(n))
    if (subset.length < draft.presetQuestions.length) body.questions = subset
  } else {
    path = '/v1/decide'
    body.questions = Object.fromEntries(draft.questions.map((q) => [q.name, questionToApi(q)]))
  }
  if (draft.minConfidence != null) body.min_confidence = draft.minConfidence
  return { method: 'POST', path, body }
}

/** Expected wall time in seconds: fixed per oracle (measured), otherwise from the option counts. */
export function draftSeconds(draft, presets) {
  if (draft.mode === 'oracle') return ORACLES[draft.oracleName]?.seconds ?? 5
  return expectedSeconds(optionCounts(draft, presets))
}

/** Options each answered question has (yes/no counts as 2), from the draft and preset definitions. */
export function optionCounts(draft, presets) {
  if (draft.mode === 'preset') {
    const defs = presets?.[draft.presetName]?.questions ?? {}
    return draft.presetSubset.map((n) => optionCount(defs[n]))
  }
  return draft.questions.map((q) => (q.type === 'choice' ? q.options.length : q.type === 'score' ? q.levels.length : 2))
}

function optionCount(def) {
  if (!def || def.type === 'yesno') return 2
  return Array.isArray(def.criteria) ? def.criteria.length : Object.keys(def.criteria).length
}

/**
 * Rough wall time on the Pi with the server idle. Laya scores every option, and cost grows
 * faster than linearly with options: measured ~3.4 s for (3, 3, 2) options and ~11.9 s for
 * the triage preset (6, 2, 4, 2, 2).
 */
export function expectedSeconds(counts) {
  return Math.max(1, Math.round(counts.reduce((t, k) => t + 0.4 + 0.15 * k * k, 0)))
}
