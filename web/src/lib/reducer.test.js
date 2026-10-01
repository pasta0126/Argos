import { expect, test } from 'vitest'
import { buildRequest, emptyDraft } from './draft'
import { draftReducer } from './reducer'
import fixture from './fixtures/presets.json'

const run = (actions, start = emptyDraft()) => actions.reduce(draftReducer, start)

test('add questions up to 10, unique names', () => {
  const d = run(Array.from({ length: 12 }, () => ({ type: 'addQuestion', qtype: 'yesno' })))
  expect(d.questions).toHaveLength(10)
  expect(new Set(d.questions.map((q) => q.name)).size).toBe(10)
})

test('customize a preset keeps text and loads its questions', () => {
  const guard = fixture.presets.guard.questions
  const d = run([
    { type: 'choosePreset', name: 'guard', questions: Object.keys(guard) },
    { type: 'patch', patch: { text: 'hola' } },
    { type: 'customizePreset', questions: guard },
  ])
  expect(d.mode).toBe('custom')
  expect(d.text).toBe('hola')
  expect(buildRequest(d).body.questions).toEqual(guard)
})

test('toggle subset and move question', () => {
  let d = run([{ type: 'choosePreset', name: 'guard', questions: ['a', 'b'] }, { type: 'toggleSubset', name: 'a' }])
  expect(d.presetSubset).toEqual(['b'])
  d = run([{ type: 'chooseCustom' }, { type: 'addQuestion', qtype: 'choice' }, { type: 'addQuestion', qtype: 'score' }])
  d = draftReducer(d, { type: 'moveQuestion', id: d.questions[1].id, delta: -1 })
  expect(d.questions.map((q) => q.type)).toEqual(['score', 'choice'])
})
