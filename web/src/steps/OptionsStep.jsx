import { formatNumber } from '../lib/answerView'
import { DEFAULT_MIN_CONFIDENCE } from '../lib/draft'

export default function OptionsStep({ draft, dispatch }) {
  const on = draft.minConfidence != null
  const set = (v) => dispatch({ type: 'patch', patch: { minConfidence: v } })
  return (
    <div>
      <div className="step-head">
        <h2>Opciones</h2>
        <p>Ajustes opcionales de la petición.</p>
      </div>
      <label className="check" style={{ fontWeight: 600 }}>
        <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked ? DEFAULT_MIN_CONFIDENCE : null)} />
        Marcar las respuestas con confianza baja
      </label>
      <p className="hint">
        Con un umbral (<code>min_confidence</code>), cada respuesta cuya confianza quede por debajo llevará{' '}
        <code>low_confidence: true</code> y se señalará con ⚠. Nunca oculta respuestas: solo las marca.
      </p>
      {on && (
        <div className="slider-row">
          <span className="hint">0</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={draft.minConfidence}
            onChange={(e) => set(Number(e.target.value))}
            aria-label="Umbral de confianza"
          />
          <span className="hint">1</span>
          <output>{formatNumber(draft.minConfidence)}</output>
        </div>
      )}
    </div>
  )
}
