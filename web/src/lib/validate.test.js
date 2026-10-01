import { describe, expect, test } from 'vitest'
import { emptyDraft, newLevel, newOption, newQuestion } from './draft'
import { validate } from './validate'

function custom(...questions) {
  return { ...emptyDraft(), mode: 'custom', text: 'texto', questions }
}

function choice(name = 'q', n = 2) {
  const q = newQuestion('choice', name)
  q.instructions = '¿?'
  q.options = Array.from({ length: n }, (_, i) => newOption(`o${i}`, `d${i}`))
  return q
}

const fields = (draft) => validate(draft).map((e) => e.field)

describe('validate', () => {
  test('a valid custom request has no errors', () => {
    expect(validate(custom(choice()))).toEqual([])
  })

  test('mode is required', () => {
    expect(fields({ ...emptyDraft(), text: 'x' })).toContain('mode')
  })

  test('empty text', () => {
    expect(validate({ ...custom(choice()), text: '  ' })[0]).toMatchObject({ step: 'text', field: 'text' })
  })

  test('text over 8000 code points, counted like Python', () => {
    expect(fields({ ...custom(choice()), text: 'a'.repeat(8001) })).toEqual(['text'])
    expect(fields({ ...custom(choice()), text: '😀'.repeat(8000) })).toEqual([])
  })

  test('no questions', () => {
    expect(fields(custom())).toEqual(['questions'])
  })

  test('more than 10 questions', () => {
    const qs = Array.from({ length: 11 }, (_, i) => choice(`q${i}`))
    expect(fields(custom(...qs))).toEqual(['questions'])
  })

  test('empty and duplicate names', () => {
    const errors = validate(custom(choice(''), choice('a'), choice('a')))
    expect(errors.map((e) => e.field)).toEqual(['name', 'name'])
    expect(errors[1].qid).toBeDefined()
  })

  test('empty instructions', () => {
    const q = choice()
    q.instructions = ''
    expect(fields(custom(q))).toEqual(['instructions'])
  })

  test('one-option choice points to the question', () => {
    const q = choice('department', 1)
    expect(validate(custom(q))).toEqual([expect.objectContaining({ step: 'questions', field: 'criteria', qid: q.id })])
  })

  test('more than 20 options', () => {
    expect(fields(custom(choice('q', 21)))).toEqual(['criteria'])
  })

  test('empty option label or description', () => {
    const q = choice()
    q.options[0].label = ''
    q.options[1].description = ''
    expect(fields(custom(q))).toEqual(['criteria', 'criteria'])
  })

  test('duplicate option labels', () => {
    const q = choice()
    q.options[1].label = q.options[0].label
    expect(fields(custom(q))).toEqual(['criteria'])
  })

  test('score with one or empty levels', () => {
    const q = newQuestion('score', 's')
    q.instructions = '¿?'
    q.levels = [newLevel('bajo')]
    expect(fields(custom(q))).toEqual(['criteria'])
    q.levels = [newLevel('bajo'), newLevel('')]
    expect(fields(custom(q))).toEqual(['criteria'])
  })

  test('yes/no with only one description', () => {
    const q = newQuestion('yesno', 'y')
    q.instructions = '¿?'
    expect(fields(custom(q))).toEqual([])
    q.yes = 'sí'
    expect(fields(custom(q))).toEqual(['criteria'])
    q.no = 'no'
    expect(fields(custom(q))).toEqual([])
  })

  test('preset with empty subset', () => {
    const d = { ...emptyDraft(), mode: 'preset', presetName: 'guard', presetQuestions: ['a'], presetSubset: [], text: 'x' }
    expect(validate(d)).toEqual([expect.objectContaining({ step: 'questions' })])
  })
})
