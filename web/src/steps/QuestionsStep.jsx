import { useEffect, useRef } from 'react'
import { MAX_OPTIONS, MAX_QUESTIONS } from '../lib/limits'
import { Errors } from './TextStep'

export const TYPE_INFO = {
  choice: {
    label: 'Opciones',
    help: 'Elige una opción entre varias. Devuelve la opción elegida y la probabilidad de cada una. Describe bien cada opción: el modelo decide por la descripción.',
  },
  score: {
    label: 'Escala',
    help: 'Sitúa el texto en una escala ordenada, del nivel más bajo al más alto. Devuelve el nivel más probable, una puntuación continua y la probabilidad de cada nivel.',
  },
  yesno: {
    label: 'Sí / No',
    help: 'Pregunta de sí o no. Devuelve la probabilidad de «sí». Opcionalmente describe qué significa cada respuesta para afinarla.',
  },
}

export default function QuestionsStep({ draft, presets, dispatch, errors, focusQid }) {
  return draft.mode === 'preset' ? (
    <PresetQuestions draft={draft} preset={presets?.[draft.presetName]} dispatch={dispatch} errors={errors} />
  ) : (
    <CustomQuestions draft={draft} dispatch={dispatch} errors={errors} focusQid={focusQid} />
  )
}

function PresetQuestions({ draft, preset, dispatch, errors }) {
  if (!preset) return <p>Preset no disponible.</p>
  const all = draft.presetQuestions
  return (
    <div>
      <div className="step-head">
        <h2>Preguntas del preset «{draft.presetName}»</h2>
        <p>Desmarca las que no necesites: menos preguntas, respuesta más rápida.</p>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className="btn small" onClick={() => dispatch({ type: 'setSubset', names: all })}>
          Todas
        </button>
        <button type="button" className="btn small" onClick={() => dispatch({ type: 'setSubset', names: [] })}>
          Ninguna
        </button>
        <span className="hint">
          {draft.presetSubset.length} de {all.length} seleccionadas
        </span>
      </div>
      <div className="qlist">
        {all.map((name) => {
          const q = preset.questions[name]
          const on = draft.presetSubset.includes(name)
          const opts = q.type === 'choice' ? Object.keys(q.criteria) : q.type === 'score' ? q.criteria : null
          return (
            <label key={name} className={`preset-q ${on ? '' : 'off'}`}>
              <input type="checkbox" checked={on} onChange={() => dispatch({ type: 'toggleSubset', name })} />
              <div>
                <div className="row">
                  <strong className="mono">{name}</strong>
                  <span className="type-badge">{TYPE_INFO[q.type].label}</span>
                </div>
                <p>{q.instructions}</p>
                {opts && (
                  <div className="opts">
                    {opts.map((o) => (
                      <span key={o}>{o}</span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>
      <Errors errors={errors} />
      <div className="msg info">
        <p>
          ¿Quieres cambiar alguna pregunta u opción?{' '}
          <button
            type="button"
            className="btn small"
            onClick={() => dispatch({ type: 'customizePreset', questions: preset.questions })}
          >
            Personalizar este preset
          </button>{' '}
          — se copiarán sus preguntas al editor y se enviará a /v1/decide.
        </p>
      </div>
    </div>
  )
}

function CustomQuestions({ draft, dispatch, errors, focusQid }) {
  const full = draft.questions.length >= MAX_QUESTIONS
  const general = errors.filter((e) => !e.qid)
  return (
    <div>
      <div className="step-head">
        <h2>Tus preguntas</h2>
        <p>Cada pregunta tiene un nombre (la clave en la respuesta), un tipo y unas instrucciones.</p>
      </div>
      <div className="qlist">
        {draft.questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            q={q}
            index={i}
            count={draft.questions.length}
            dispatch={dispatch}
            errors={errors.filter((e) => e.qid === q.id)}
            focus={focusQid?.id === q.id ? focusQid : null}
          />
        ))}
      </div>
      {draft.questions.length === 0 && <p className="hint">Aún no hay preguntas. Añade la primera:</p>}
      <div className="add-row">
        {Object.entries(TYPE_INFO).map(([type, info]) => (
          <button
            key={type}
            type="button"
            className="btn"
            disabled={full}
            onClick={() => dispatch({ type: 'addQuestion', qtype: type })}
          >
            + {info.label}
          </button>
        ))}
        {full && <span className="hint">Máximo {MAX_QUESTIONS} preguntas por petición.</span>}
      </div>
      <Errors errors={general} />
    </div>
  )
}

function QuestionEditor({ q, index, count, dispatch, errors, focus }) {
  const ref = useRef(null)
  const patch = (p) => dispatch({ type: 'patchQuestion', id: q.id, patch: p })
  const bad = (field) => errors.some((e) => e.field === field)

  useEffect(() => {
    if (!focus || !ref.current) return
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current.classList.remove('flash')
    void ref.current.offsetWidth
    ref.current.classList.add('flash')
  }, [focus])

  return (
    <section ref={ref} className={`qcard ${errors.length ? 'has-error' : ''}`} aria-label={`Pregunta ${index + 1}`}>
      <div className="qcard-head">
        <span className="idx">{index + 1}</span>
        <input
          type="text"
          value={q.name}
          onChange={(e) => patch({ name: e.target.value })}
          aria-label="Nombre de la pregunta"
          placeholder="nombre"
          className={`mono ${bad('name') ? 'invalid' : ''}`}
          spellCheck={false}
        />
        <div className="segmented" role="group" aria-label="Tipo">
          {Object.entries(TYPE_INFO).map(([type, info]) => (
            <button key={type} type="button" aria-pressed={q.type === type} onClick={() => patch({ type })}>
              {info.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn ghost icon" disabled={index === 0} onClick={() => dispatch({ type: 'moveQuestion', id: q.id, delta: -1 })} aria-label="Subir">
          ↑
        </button>
        <button type="button" className="btn ghost icon" disabled={index === count - 1} onClick={() => dispatch({ type: 'moveQuestion', id: q.id, delta: 1 })} aria-label="Bajar">
          ↓
        </button>
        <button type="button" className="btn ghost icon danger" onClick={() => dispatch({ type: 'removeQuestion', id: q.id })} aria-label="Eliminar pregunta">
          ✕
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        {TYPE_INFO[q.type].help}
      </p>
      <label className="field">
        <span>Instrucciones</span>
        <input
          type="text"
          value={q.instructions}
          onChange={(e) => patch({ instructions: e.target.value })}
          placeholder={q.type === 'yesno' ? '¿Pide un reembolso?' : q.type === 'score' ? '¿Cómo de urgente es?' : '¿Qué departamento debe gestionarlo?'}
          className={bad('instructions') ? 'invalid' : ''}
        />
      </label>
      {q.type === 'choice' && <ChoiceEditor q={q} dispatch={dispatch} />}
      {q.type === 'score' && <ScoreEditor q={q} dispatch={dispatch} />}
      {q.type === 'yesno' && <YesNoEditor q={q} patch={patch} />}
      <Errors errors={errors} />
    </section>
  )
}

function ItemActions({ q, list, item, i, n, dispatch }) {
  return (
    <div className="item-actions">
      <button type="button" className="btn ghost icon small" disabled={i === 0} onClick={() => dispatch({ type: 'moveItem', id: q.id, list, itemId: item.id, delta: -1 })} aria-label="Subir">
        ↑
      </button>
      <button type="button" className="btn ghost icon small" disabled={i === n - 1} onClick={() => dispatch({ type: 'moveItem', id: q.id, list, itemId: item.id, delta: 1 })} aria-label="Bajar">
        ↓
      </button>
      <button type="button" className="btn ghost icon small danger" onClick={() => dispatch({ type: 'removeItem', id: q.id, list, itemId: item.id })} aria-label="Quitar">
        ✕
      </button>
    </div>
  )
}

function ChoiceEditor({ q, dispatch }) {
  const set = (itemId, p) => dispatch({ type: 'patchItem', id: q.id, list: 'options', itemId, patch: p })
  return (
    <div>
      <span className="field-label">Opciones · nombre y descripción</span>
      <div className="items">
        {q.options.map((o, i) => (
          <div key={o.id} className="item-row">
            <span className="n">{i + 1}</span>
            <input type="text" className="mono" value={o.label} onChange={(e) => set(o.id, { label: e.target.value })} placeholder="billing" aria-label={`Nombre de la opción ${i + 1}`} spellCheck={false} />
            <input type="text" className="desc" value={o.description} onChange={(e) => set(o.id, { description: e.target.value })} placeholder="pagos, facturas, reembolsos" aria-label={`Descripción de la opción ${i + 1}`} />
            <ItemActions q={q} list="options" item={o} i={i} n={q.options.length} dispatch={dispatch} />
          </div>
        ))}
      </div>
      <button type="button" className="btn small" style={{ marginTop: 8 }} disabled={q.options.length >= MAX_OPTIONS} onClick={() => dispatch({ type: 'addItem', id: q.id, list: 'options' })}>
        + Opción
      </button>
    </div>
  )
}

function ScoreEditor({ q, dispatch }) {
  return (
    <div>
      <span className="field-label">Niveles · del más bajo al más alto</span>
      <div className="items">
        {q.levels.map((l, i) => (
          <div key={l.id} className="item-row level">
            <span className="n">{i}</span>
            <input
              type="text"
              value={l.text}
              onChange={(e) => dispatch({ type: 'patchItem', id: q.id, list: 'levels', itemId: l.id, patch: { text: e.target.value } })}
              placeholder={['nada urgente', 'pronto', 'bloqueante'][i] ?? 'nivel'}
              aria-label={`Nivel ${i}`}
            />
            <ItemActions q={q} list="levels" item={l} i={i} n={q.levels.length} dispatch={dispatch} />
          </div>
        ))}
      </div>
      <button type="button" className="btn small" style={{ marginTop: 8 }} disabled={q.levels.length >= MAX_OPTIONS} onClick={() => dispatch({ type: 'addItem', id: q.id, list: 'levels' })}>
        + Nivel
      </button>
    </div>
  )
}

function YesNoEditor({ q, patch }) {
  return (
    <div>
      <span className="field-label">
        Descripciones <span className="hint">(opcional: las dos o ninguna)</span>
      </span>
      <div className="items">
        <div className="item-row level">
          <span className="n">Sí</span>
          <input type="text" value={q.yes} onChange={(e) => patch({ yes: e.target.value })} placeholder="pide que le devuelvan el dinero" aria-label="Qué significa sí" />
          <span />
        </div>
        <div className="item-row level">
          <span className="n">No</span>
          <input type="text" value={q.no} onChange={(e) => patch({ no: e.target.value })} placeholder="no pide ningún reembolso" aria-label="Qué significa no" />
          <span />
        </div>
      </div>
    </div>
  )
}
