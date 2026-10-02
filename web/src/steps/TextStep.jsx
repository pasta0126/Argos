import { MAX_QUESTION_CHARS, MAX_TEXT_CHARS, textLength } from '../lib/limits'

export default function TextStep({ draft, dispatch, errors }) {
  if (draft.mode === 'oracle') return <OracleQuestion draft={draft} dispatch={dispatch} errors={errors} />
  const n = textLength(draft.text)
  const over = n > MAX_TEXT_CHARS
  return (
    <div>
      <div className="step-head">
        <h2>El texto a analizar</h2>
        <p>Un mensaje, un correo, un comentario… Argos responderá las preguntas sobre este texto.</p>
      </div>
      <label className="field">
        <span className="sr-only">Texto</span>
        <textarea
          value={draft.text}
          onChange={(e) => dispatch({ type: 'patch', patch: { text: e.target.value } })}
          placeholder="Ej.: Me han cobrado dos veces este mes. Quiero un reembolso."
          className={errors.length ? 'invalid' : ''}
          autoFocus
        />
        <div className={`counter ${over ? 'over' : ''}`} aria-live="polite">
          {n.toLocaleString('es-ES')} / {MAX_TEXT_CHARS.toLocaleString('es-ES')} caracteres{over ? ' · demasiado largo' : ''}
        </div>
      </label>
      <Errors errors={errors} />
    </div>
  )
}

function OracleQuestion({ draft, dispatch, errors }) {
  const n = textLength(draft.text)
  const over = n > MAX_QUESTION_CHARS
  return (
    <div>
      <div className="step-head">
        <h2>Tu pregunta</h2>
        <p>Lo único que lee el oráculo. {draft.oracleName === '8ball' ? 'La bola responde con una de sus frases.' : 'Te responderá sí o no.'}</p>
      </div>
      {draft.oracleName === 'yesno' && (
        <div className="msg warn">
          <p>
            Haz una pregunta que se conteste con <b>sí</b> o <b>no</b>. El oráculo responde sí o no a cualquier cosa, también a
            «¿Por qué el cielo es azul?».
          </p>
        </div>
      )}
      <label className="field">
        <span>Pregunta</span>
        <textarea
          className={`short ${errors.length ? 'invalid' : ''}`}
          value={draft.text}
          onChange={(e) => dispatch({ type: 'patch', patch: { text: e.target.value } })}
          placeholder="Ej.: ¿Me saldrá bien el examen de mañana?"
          autoFocus
        />
        <div className={`counter ${over ? 'over' : ''}`} aria-live="polite">
          {n} / {MAX_QUESTION_CHARS} caracteres{over ? ' · demasiado largo' : ''}
        </div>
      </label>
      <Errors errors={errors} />
    </div>
  )
}

export function Errors({ errors }) {
  if (!errors.length) return null
  return (
    <div className="msg error" role="alert">
      <div>
        {errors.length === 1 ? (
          <p>{errors[0].message}</p>
        ) : (
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
