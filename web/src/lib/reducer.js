import { draftFromBody, emptyDraft, freeName, newLevel, newOption, newQuestion, questionsFromApi } from './draft'
import { MAX_QUESTIONS } from './limits'

const mapQ = (draft, id, fn) => ({ ...draft, questions: draft.questions.map((q) => (q.id === id ? fn(q) : q)) })

export function draftReducer(draft, action) {
  switch (action.type) {
    case 'patch':
      return { ...draft, ...action.patch }
    case 'reset':
      return emptyDraft()
    case 'choosePreset':
      return {
        ...draft,
        mode: 'preset',
        presetName: action.name,
        presetQuestions: action.questions,
        presetSubset: action.questions,
      }
    case 'chooseCustom':
      return { ...draft, mode: 'custom', presetName: null }
    case 'loadExample': {
      const loaded = draftFromBody(action.body)
      return { ...loaded, presetName: null }
    }
    case 'customizePreset':
      return { ...draft, mode: 'custom', presetName: null, questions: questionsFromApi(action.questions) }
    case 'toggleSubset': {
      const has = draft.presetSubset.includes(action.name)
      return { ...draft, presetSubset: has ? draft.presetSubset.filter((n) => n !== action.name) : [...draft.presetSubset, action.name] }
    }
    case 'setSubset':
      return { ...draft, presetSubset: action.names }
    case 'addQuestion':
      if (draft.questions.length >= MAX_QUESTIONS) return draft
      return { ...draft, questions: [...draft.questions, newQuestion(action.qtype, freeName(draft.questions))] }
    case 'removeQuestion':
      return { ...draft, questions: draft.questions.filter((q) => q.id !== action.id) }
    case 'moveQuestion': {
      const qs = [...draft.questions]
      const i = qs.findIndex((q) => q.id === action.id)
      const j = i + action.delta
      if (i < 0 || j < 0 || j >= qs.length) return draft
      ;[qs[i], qs[j]] = [qs[j], qs[i]]
      return { ...draft, questions: qs }
    }
    case 'patchQuestion':
      return mapQ(draft, action.id, (q) => ({ ...q, ...action.patch }))
    case 'addItem':
      return mapQ(draft, action.id, (q) =>
        action.list === 'options' ? { ...q, options: [...q.options, newOption()] } : { ...q, levels: [...q.levels, newLevel()] },
      )
    case 'patchItem':
      return mapQ(draft, action.id, (q) => ({
        ...q,
        [action.list]: q[action.list].map((it) => (it.id === action.itemId ? { ...it, ...action.patch } : it)),
      }))
    case 'removeItem':
      return mapQ(draft, action.id, (q) => ({ ...q, [action.list]: q[action.list].filter((it) => it.id !== action.itemId) }))
    case 'moveItem':
      return mapQ(draft, action.id, (q) => {
        const items = [...q[action.list]]
        const i = items.findIndex((it) => it.id === action.itemId)
        const j = i + action.delta
        if (i < 0 || j < 0 || j >= items.length) return q
        ;[items[i], items[j]] = [items[j], items[i]]
        return { ...q, [action.list]: items }
      })
    default:
      throw new Error(`unknown action ${action.type}`)
  }
}
