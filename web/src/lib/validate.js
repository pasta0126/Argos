import { MAX_OPTIONS, MAX_QUESTION_CHARS, MAX_QUESTIONS, MAX_TEXT_CHARS, MIN_OPTIONS, textLength } from './limits'
import { ORACLES } from './oracles'

const blank = (s) => !s || !s.trim()

/**
 * Everything the API would reject, as [{ step, qid?, field, message }].
 * `step` is the wizard step that owns the field; `qid` the custom question, if any.
 */
export function validate(draft) {
  const errors = []
  const err = (step, field, message, qid) => errors.push({ step, field, message, ...(qid ? { qid } : {}) })

  if (!draft.mode) err('mode', 'mode', 'Elige un preset, una petición personalizada o un ejemplo.')

  if (draft.mode === 'oracle') {
    if (!(draft.oracleName in ORACLES)) err('mode', 'oracle', 'Elige un oráculo.')
    if (blank(draft.text)) err('text', 'question', 'La pregunta es obligatoria.')
    else if (textLength(draft.text) > MAX_QUESTION_CHARS)
      err('text', 'question', `La pregunta supera el máximo de ${MAX_QUESTION_CHARS} caracteres.`)
    // No threshold check: oracle requests never send min_confidence.
    return errors
  }

  if (blank(draft.text)) err('text', 'text', 'El texto es obligatorio.')
  else if (textLength(draft.text) > MAX_TEXT_CHARS)
    err('text', 'text', `El texto supera el máximo de ${MAX_TEXT_CHARS.toLocaleString('es-ES')} caracteres.`)

  if (draft.mode === 'preset') {
    if (!draft.presetName) err('mode', 'preset', 'Elige un preset.')
    else if (draft.presetSubset.length === 0) err('questions', 'questions', 'Marca al menos una pregunta del preset.')
  }

  if (draft.mode === 'custom') {
    const qs = draft.questions
    if (qs.length === 0) err('questions', 'questions', 'Añade al menos una pregunta.')
    if (qs.length > MAX_QUESTIONS) err('questions', 'questions', `Como máximo ${MAX_QUESTIONS} preguntas por petición.`)
    const names = qs.map((q) => q.name)
    qs.forEach((q, i) => {
      const where = `Pregunta ${i + 1}${blank(q.name) ? '' : ` («${q.name}»)`}`
      const e = (field, message) => err('questions', field, `${where}: ${message}`, q.id)
      if (blank(q.name)) e('name', 'le falta el nombre.')
      else if (names.indexOf(q.name) !== i) e('name', 'el nombre está repetido.')
      if (blank(q.instructions)) e('instructions', 'faltan las instrucciones (la pregunta en sí).')
      if (q.type === 'choice' || q.type === 'score') {
        const items = q.type === 'choice' ? q.options : q.levels
        const noun = q.type === 'choice' ? 'opciones' : 'niveles'
        if (items.length < MIN_OPTIONS) e('criteria', `necesita al menos ${MIN_OPTIONS} ${noun}.`)
        if (items.length > MAX_OPTIONS) e('criteria', `como máximo ${MAX_OPTIONS} ${noun}.`)
      }
      if (q.type === 'choice') {
        if (q.options.some((o) => blank(o.label))) e('criteria', 'hay opciones sin nombre.')
        if (q.options.some((o) => blank(o.description))) e('criteria', 'hay opciones sin descripción.')
        const labels = q.options.map((o) => o.label).filter((l) => !blank(l))
        if (new Set(labels).size !== labels.length) e('criteria', 'hay opciones con el mismo nombre.')
      }
      if (q.type === 'score' && q.levels.some((l) => blank(l.text))) e('criteria', 'hay niveles vacíos.')
      if (q.type === 'yesno' && blank(q.yes) !== blank(q.no))
        e('criteria', 'describe tanto el «sí» como el «no», o deja ambos vacíos.')
    })
  }

  if (draft.minConfidence != null && !(draft.minConfidence >= 0 && draft.minConfidence <= 1))
    err('options', 'min_confidence', 'El umbral debe estar entre 0 y 1.')

  return errors
}
