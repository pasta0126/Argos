import { draftSeconds, optionCounts } from '../lib/draft'
import { ORACLES } from '../lib/oracles'
import { formatNumber } from '../lib/answerView'
import { PUBLIC_API_URL } from '../lib/config'
import RunStatus from '../components/RunStatus'
import { STEPS } from '../components/Stepper'

export default function ReviewStep({ draft, presets, request, errors, run, health, onSend, onCancel, onGoError, onErrorAction, onBack }) {
  const counts = optionCounts(draft, presets)
  const n = counts.length
  const expected = draftSeconds(draft, presets)
  const oracle = draft.mode === 'oracle' ? ORACLES[draft.oracleName] : null
  const busy = run.phase === 'running' || run.phase === 'waiting'
  return (
    <div>
      <div className="step-head">
        <h2>Revisar y enviar</h2>
        <p>Comprueba la petición. Al enviarla verás la respuesta de forma visual y en JSON.</p>
      </div>
      <dl className="summary">
        <dt>Endpoint</dt>
        <dd>
          <code>
            POST {PUBLIC_API_URL}
            {request.path}
          </code>
        </dd>
        <dt>Modo</dt>
        <dd>{oracle ? oracle.title : draft.mode === 'preset' ? `Preset «${draft.presetName}»` : 'Preguntas personalizadas'}</dd>
        <dt>{oracle ? 'Pregunta' : 'Texto'}</dt>
        <dd>{draft.text.length > 160 ? `${draft.text.slice(0, 160)}…` : draft.text || <em>vacío</em>}</dd>
        <dt>Preguntas</dt>
        <dd>
          {oracle ? '1 (fija)' : n}
          {draft.mode === 'preset' && n < draft.presetQuestions.length ? ` de ${draft.presetQuestions.length}` : ''}
        </dd>
        <dt>Umbral</dt>
        <dd>{oracle ? 'sin umbral (el oráculo no lo usa)' : draft.minConfidence == null ? 'sin umbral' : formatNumber(draft.minConfidence)}</dd>
        <dt>Duración estimada</dt>
        <dd>≈ {expected} s si el servidor está libre</dd>
      </dl>

      {errors.length > 0 && (
        <div className="msg error" role="alert">
          <div>
            <p>
              <strong>Corrige esto antes de enviar:</strong>
            </p>
            <ul className="errlist">
              {errors.map((e, i) => (
                <li key={i}>
                  <button type="button" onClick={() => onGoError(e)}>
                    {STEPS.find((s) => s.key === e.step)?.label}: {e.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {health.status === 'loading' && !busy && (
        <div className="msg warn">
          <p>El modelo aún se está cargando. Puedes enviar igualmente: se reintentará solo hasta que esté listo.</p>
        </div>
      )}
      {health.status === 'down' && !busy && (
        <div className="msg warn">
          <p>Ahora mismo no hay conexión con la API; el envío probablemente falle.</p>
        </div>
      )}

      <RunStatus run={run} expected={expected} onCancel={onCancel} onRetry={onSend} onAction={onErrorAction} />

      <div className="nav">
        <button type="button" className="btn" onClick={onBack} disabled={busy}>
          ← Atrás
        </button>
        <button type="button" className="btn primary big" disabled={errors.length > 0 || busy} onClick={onSend}>
          {busy ? 'Enviando…' : 'Enviar petición'}
        </button>
      </div>
    </div>
  )
}
