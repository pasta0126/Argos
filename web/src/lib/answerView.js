const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 0.91 → "91 %", 0.004 → "0,4 %", 0.0004 → "<0,1 %". */
export function formatPct(p) {
  const pct = p * 100
  if (pct > 0 && pct < 0.1) return '<0,1 %'
  if (pct > 0 && pct < 1) return `${nf1.format(pct)} %`
  return `${nf0.format(pct)} %`
}

export const formatNumber = (x) => nf2.format(x)

/** Type of an answer, from its shape (works for presets without fetching definitions). */
export function answerKind(answer) {
  if ('choice' in answer) return 'choice'
  if ('level' in answer) return 'score'
  return 'yesno'
}

/**
 * What an answer card draws. `def` is the question definition if known (adds descriptions),
 * `threshold` the min_confidence sent (or null).
 */
export function answerView(answer, def = null, threshold = null) {
  const kind = answerKind(answer)
  const common = {
    kind,
    confidence: answer.confidence,
    low: answer.low_confidence === true,
    threshold,
    instructions: def?.instructions ?? null,
  }
  if (kind === 'choice') {
    const rows = Object.entries(answer.probabilities)
      .map(([label, p]) => ({
        label,
        p,
        pct: formatPct(p),
        winner: label === answer.choice,
        description: def?.criteria?.[label] ?? null,
      }))
      .sort((a, b) => b.p - a.p)
    return { ...common, rows, chosen: answer.choice }
  }
  if (kind === 'score') {
    const labels = def?.criteria ?? null
    const n = answer.probabilities.length
    const rows = answer.probabilities.map((p, i) => {
      const label = labels?.[i] ?? `Nivel ${i}`
      return { label, index: i, p, pct: formatPct(p), winner: labels ? label === answer.level : i === Math.round(answer.score) }
    })
    return { ...common, rows, level: answer.level, score: answer.score, max: n - 1, marker: n > 1 ? answer.score / (n - 1) : 0 }
  }
  return {
    ...common,
    pYes: answer.probability,
    yesPct: formatPct(answer.probability),
    noPct: formatPct(1 - answer.probability),
    answer: answer.answer,
    yesText: def?.criteria?.yes ?? null,
    noText: def?.criteria?.no ?? null,
  }
}

/** 12.7 → "12,7 %" (oracle percentages already come as 0–100 with one decimal). */
export const formatPct100 = (x) => `${nf1.format(x)} %`

/** What the yes/no oracle result draws, from the /v1/oracle/yesno response. */
export function oracleYesNoView(data) {
  return {
    answer: data.answer,
    label: data.answer ? 'Sí' : 'No',
    pYes: data.probability,
    yesPct: formatPct(data.probability),
    noPct: formatPct(1 - data.probability),
    confidence: data.confidence,
    confidencePct: formatPct(data.confidence),
  }
}

const KIND_ORDER = ['affirmative', 'non_committal', 'negative']

/**
 * What the 8-Ball result draws, from the /v1/oracle/8ball response. Bars keep scale order and
 * are scaled to the largest phrase (each phrase rarely passes ~15 %), `width` in 0–100.
 */
export function eightBallView(data) {
  const max = Math.max(...data.phrases.map((p) => p.percentage), 0.1)
  return {
    answer: data.answer,
    kind: data.kind,
    rows: data.phrases.map((p, i) => ({
      index: i,
      phrase: p.phrase,
      kind: p.kind,
      pct: formatPct100(p.percentage),
      width: (p.percentage / max) * 100,
      winner: p.phrase === data.answer,
    })),
    totals: KIND_ORDER.map((kind) => ({ kind, value: data.totals[kind], pct: formatPct100(data.totals[kind]) })),
  }
}
