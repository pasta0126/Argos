import { useNow } from '../hooks'
import JsonView from './JsonView'

const REASON = {
  loading: 'El modelo se está cargando',
  busy: 'El servidor está ocupado con otra petición',
}

/** Progress, retry countdown, cancellation and error explanation of the current send. */
export default function RunStatus({ run, expected, onCancel, onRetry, onAction }) {
  const active = run.phase === 'running' || run.phase === 'waiting'
  const now = useNow(active)

  if (run.phase === 'idle' || run.phase === 'done') return null

  if (run.phase === 'cancelled') {
    return (
      <div className="msg info" role="status">
        <p>Petición cancelada. Tu petición sigue aquí; puedes enviarla de nuevo cuando quieras.</p>
      </div>
    )
  }

  if (run.phase === 'error') {
    const { error, response } = run
    return (
      <div className="msg error" role="alert">
        <div style={{ width: '100%' }}>
          <p>
            <strong>{error.title}</strong>
          </p>
          <p>{error.detail}</p>
          <div className="row" style={{ margin: '8px 0' }}>
            {error.action === 'key' && (
              <button type="button" className="btn small" onClick={() => onAction(error)}>
                Cambiar clave
              </button>
            )}
            {error.action === 'question' && (
              <button type="button" className="btn small" onClick={() => onAction(error)}>
                Ir a la pregunta «{error.question}»
              </button>
            )}
            {error.action === 'retry' && (
              <button type="button" className="btn small" onClick={onRetry}>
                Reintentar
              </button>
            )}
          </div>
          {response && (
            <details>
              <summary>
                Ver respuesta de la API (HTTP {response.status || 'sin respuesta'})
              </summary>
              {response.data != null && (
                <JsonView value={response.data} raw={typeof response.data === 'string'} title={`HTTP ${response.status}`} />
              )}
            </details>
          )}
        </div>
      </div>
    )
  }

  const elapsed = Math.max(0, (now - run.startedAt) / 1000)
  const waiting = run.phase === 'waiting'
  const left = waiting ? Math.min(run.wait.seconds, Math.max(0, Math.ceil((run.wait.until - now) / 1000))) : 0
  // Fills to 90 % over the estimate, then waits for the real answer.
  const pct = waiting ? 100 * (1 - left / run.wait.seconds) : Math.min(90, (elapsed / expected) * 90)

  return (
    <div className="run" role="status" aria-live="polite">
      <div className="run-head">
        <span className="spinner" aria-hidden="true" />
        <span className="grow">
          {waiting
            ? `${REASON[run.wait.reason]}: reintento ${run.wait.attempt + 1} de ${run.wait.maxAttempts} en ${left} s`
            : run.attempt > 1
              ? `Reintentando (intento ${run.attempt})… el modelo está respondiendo`
              : 'Enviando… el modelo está analizando el texto'}
        </span>
        <button type="button" className="btn small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <div className={`progress ${waiting ? 'waiting' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="run-meta">
        {elapsed.toFixed(1).replace('.', ',')} s transcurridos · estimado ≈ {expected} s (aprox.)
        {!waiting && elapsed > expected * 1.5 && ' · tarda más de lo normal, puede haber otras peticiones en cola'}
      </div>
    </div>
  )
}
