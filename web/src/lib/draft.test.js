import { describe, expect, test } from 'vitest'
import { buildRequest, draftFromBody, draftSeconds, emptyDraft, expectedSeconds, freeName, newOption, newQuestion, optionCounts, questionsFromApi } from './draft'

// server/examples holds valid /v1/decide bodies (Postman/tests); the editor must round-trip them.
const EXAMPLES = Object.entries(import.meta.glob('../../../server/examples/*.json', { eager: true, import: 'default' }))
  .map(([path, body]) => ({ id: path.split('/').pop().replace(/\.json$/, ''), body }))
  .filter((e) => e.body.questions && !Array.isArray(e.body.questions))
import fixture from './fixtures/presets.json'

const presetDraft = (name, subset) => {
  const names = Object.keys(fixture.presets[name].questions)
  return { ...emptyDraft(), mode: 'preset', presetName: name, presetQuestions: names, presetSubset: subset ?? names, text: 'hola', minConfidence: null }
}

describe('buildRequest, preset mode', () => {
  test('subset is sent as a questions list, in preset order', () => {
    const r = buildRequest(presetDraft('guard', ['jailbreak']))
    expect(r).toEqual({ method: 'POST', path: '/v1/presets/guard', body: { text: 'hola', questions: ['jailbreak'] } })
  })

  test('subset keeps preset order whatever the checking order', () => {
    const names = Object.keys(fixture.presets.guard.questions)
    const r = buildRequest(presetDraft('guard', [names[2], names[0]]))
    expect(r.body.questions).toEqual([names[0], names[2]])
  })

  test('all selected omits questions', () => {
    expect(buildRequest(presetDraft('triage')).body).toEqual({ text: 'hola' })
  })

  test('threshold sent when set', () => {
    expect(buildRequest({ ...presetDraft('triage'), minConfidence: 0.8 }).body).toEqual({ text: 'hola', min_confidence: 0.8 })
  })
})

describe('buildRequest, custom mode', () => {
  test('choice question as in the spec scenario', () => {
    const q = newQuestion('choice', 'department')
    q.instructions = '¿Qué departamento?'
    q.options = [newOption('billing', 'pagos'), newOption('technical', 'errores')]
    const r = buildRequest({ ...emptyDraft(), mode: 'custom', text: 't', questions: [q] })
    expect(r.path).toBe('/v1/decide')
    expect(r.body.questions.department).toEqual({
      type: 'choice',
      instructions: '¿Qué departamento?',
      criteria: { billing: 'pagos', technical: 'errores' },
    })
  })

  test('yes/no without descriptions has no criteria', () => {
    const q = newQuestion('yesno', 'refund')
    q.instructions = '¿Pide un reembolso?'
    const r = buildRequest({ ...emptyDraft(), mode: 'custom', text: 't', questions: [q] })
    expect(r.body.questions.refund).toEqual({ type: 'yesno', instructions: '¿Pide un reembolso?' })
  })

  test('threshold off means no min_confidence', () => {
    const r = buildRequest({ ...emptyDraft(), mode: 'custom', text: 't', questions: [], minConfidence: null })
    expect('min_confidence' in r.body).toBe(false)
  })

  test('low-confidence threshold is on by default at 0.8', () => {
    expect(buildRequest({ ...emptyDraft(), text: 't' }).body.min_confidence).toBe(0.8)
  })

  test('renaming a question renames the key', () => {
    const q = newQuestion('yesno', 'q1')
    const draft = { ...emptyDraft(), mode: 'custom', text: 't', questions: [q] }
    const renamed = { ...draft, questions: [{ ...q, name: 'refund' }] }
    expect(Object.keys(buildRequest(renamed).body.questions)).toEqual(['refund'])
  })
})

describe('round trip', () => {
  test('server examples are found', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5)
  })

  test.each(EXAMPLES.map((e) => [e.id, e.body]))('example %s', (_id, body) => {
    expect(buildRequest(draftFromBody(body)).body).toEqual(body)
  })

  test.each(Object.entries(fixture.presets))('preset %s questions', (_name, preset) => {
    const draft = { ...draftFromBody({ text: 't', questions: preset.questions }) }
    expect(buildRequest(draft).body.questions).toEqual(preset.questions)
  })

  test('ticket-full example loads text, three questions and 0.8', () => {
    const d = draftFromBody(EXAMPLES.find((e) => e.id === 'ticket-full').body)
    expect(d.mode).toBe('custom')
    expect(d.text).toMatch(/cobrado dos veces/)
    expect(d.questions.map((q) => q.name)).toEqual(['department', 'urgency', 'refund'])
    expect(d.minConfidence).toBe(0.8)
  })
})

test('freeName skips taken names', () => {
  expect(freeName(questionsFromApi({ q1: { type: 'yesno', instructions: 'x' } }))).toBe('q2')
})

test('duration estimate follows options, close to measured times', () => {
  const ticket = draftFromBody(EXAMPLES.find((e) => e.id === 'ticket-full').body)
  expect(optionCounts(ticket)).toEqual([3, 3, 2])
  expect(expectedSeconds(optionCounts(ticket))).toBe(5)
  const triage = presetDraft('triage')
  expect(optionCounts(triage, fixture.presets)).toEqual([6, 2, 4, 2, 2])
  expect(expectedSeconds(optionCounts(triage, fixture.presets))).toBe(12)
})

describe('buildRequest, oracle mode', () => {
  const oracle = (name, extra = {}) => ({ ...emptyDraft(), mode: 'oracle', oracleName: name, text: '¿Lloverá mañana?', ...extra })

  test('yes/no payload is exactly the question (spec scenario)', () => {
    expect(buildRequest(oracle('yesno'))).toEqual({ method: 'POST', path: '/v1/oracle/yesno', body: { question: '¿Lloverá mañana?' } })
  })

  test('8-Ball targets its endpoint', () => {
    expect(buildRequest(oracle('8ball')).path).toBe('/v1/oracle/8ball')
  })

  test('never sends min_confidence, even when the flag is set', () => {
    expect(buildRequest(oracle('yesno', { minConfidence: 0.8 })).body).toEqual({ question: '¿Lloverá mañana?' })
  })

  test('fixed expected duration per oracle instead of the k² formula', () => {
    expect(draftSeconds(oracle('yesno'))).toBe(2)
    expect(draftSeconds(oracle('8ball'))).toBe(5)
    expect(expectedSeconds([20])).toBeGreaterThan(30)
  })
})
