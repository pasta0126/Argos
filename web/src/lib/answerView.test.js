import { describe, expect, test } from 'vitest'
import { answerKind, answerView, eightBallView, formatPct, oracleYesNoView } from './answerView'
import oracleFixture from './fixtures/oracle.json'
import { PHRASES } from './oracles'

describe('formatPct', () => {
  test.each([
    [0.91, '91 %'],
    [0.06, '6 %'],
    [0.03, '3 %'],
    [0.004, '0,4 %'],
    [0.0004, '<0,1 %'],
    [0, '0 %'],
    [1, '100 %'],
  ])('%s → %s', (p, s) => expect(formatPct(p)).toBe(s))
})

describe('answerView', () => {
  test('choice bars sorted with the winner highlighted (spec scenario)', () => {
    const v = answerView({ choice: 'billing', probabilities: { other: 0.03, billing: 0.91, technical: 0.06 }, confidence: 0.91 })
    expect(v.kind).toBe('choice')
    expect(v.rows.map((r) => [r.label, r.pct, r.winner])).toEqual([
      ['billing', '91 %', true],
      ['technical', '6 %', false],
      ['other', '3 %', false],
    ])
  })

  test('score keeps level order and marks the score (spec scenario)', () => {
    const def = { type: 'score', criteria: ['nada urgente', 'pronto', 'bloqueante'] }
    const v = answerView({ score: 1.6, level: 'bloqueante', probabilities: [0.1, 0.2, 0.7], confidence: 0.7 }, def)
    expect(v.rows.map((r) => r.label)).toEqual(['nada urgente', 'pronto', 'bloqueante'])
    expect(v.rows.map((r) => r.winner)).toEqual([false, false, true])
    expect(v.max).toBe(2)
    expect(v.marker).toBeCloseTo(0.8)
  })

  test('score without definition uses generic labels and nearest level', () => {
    const v = answerView({ score: 0.4, level: 'x', probabilities: [0.6, 0.4], confidence: 0.6 })
    expect(v.rows.map((r) => [r.label, r.winner])).toEqual([
      ['Nivel 0', true],
      ['Nivel 1', false],
    ])
  })

  test('yes/no split', () => {
    const v = answerView({ probability: 0.9, answer: true, confidence: 0.9 })
    expect(v).toMatchObject({ kind: 'yesno', yesPct: '90 %', noPct: '10 %', answer: true })
  })

  test('low confidence flag and threshold', () => {
    const v = answerView({ probability: 0.6, answer: true, confidence: 0.6, low_confidence: true }, null, 0.8)
    expect(v).toMatchObject({ low: true, threshold: 0.8 })
    expect(answerView({ probability: 0.6, answer: true, confidence: 0.6 }).low).toBe(false)
  })

  test('kind detection', () => {
    expect(answerKind({ choice: 'a' })).toBe('choice')
    expect(answerKind({ level: 'a', score: 1 })).toBe('score')
    expect(answerKind({ probability: 0.2 })).toBe('yesno')
  })
})

describe('oracle views', () => {
  test('yes/no shows a big Sí and 82 % (spec scenario)', () => {
    const v = oracleYesNoView(oracleFixture.yesno)
    expect(v.label).toBe('Sí')
    expect(v.yesPct).toBe('82 %')
    expect(v.noPct).toBe('18 %')
    expect(oracleYesNoView({ ...oracleFixture.yesno, answer: false, probability: 0.3 }).label).toBe('No')
  })

  test('8-Ball: winner, 20 bars in scale order coloured by kind, totals (spec scenario)', () => {
    const v = eightBallView(oracleFixture['8ball'])
    expect(v.answer).toBe('Sin lugar a dudas')
    expect(v.rows).toHaveLength(20)
    expect(v.rows.map((r) => [r.phrase, r.kind])).toEqual(PHRASES)
    expect(v.rows.filter((r) => r.winner).map((r) => r.index)).toEqual([18])
    expect(v.rows[18]).toMatchObject({ pct: '12,7 %', width: 100 })
    expect(v.rows[0].width).toBeCloseTo((3.1 / 12.7) * 100)
    expect(v.totals.map((t) => [t.kind, t.pct])).toEqual([
      ['affirmative', '64,1 %'],
      ['non_committal', '19,3 %'],
      ['negative', '16,6 %'],
    ])
  })
})
