import { MAX_TEXT_CHARS, textLength } from '../lib/limits'

export default function TextStep({ draft, dispatch, errors }) {
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
