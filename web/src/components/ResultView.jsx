import { useState } from 'react'
import { curlFor } from '../lib/api'
import { PUBLIC_API_URL } from '../lib/config'
import AnswerCard from './AnswerCard'
import JsonView from './JsonView'

const TABS = [
  ['visual', 'Visual'],
  ['payload', 'Payload'],
  ['response', 'Respuesta'],
  ['curl', 'curl'],
]

export default function ResultView({ run, defs, onEdit, onNew }) {
  const [tab, setTab] = useState('visual')
  const { request, response } = run
  const data = response.data
  const threshold = request.body.min_confidence ?? null
  const lowCount = Object.values(data.answers).filter((a) => a.low_confidence).length
  const endpoint = (
    <>
      <span className="method mono">{request.method}</span>
      <code>
        {PUBLIC_API_URL}
        {request.path}
      </code>
    </>
  )

  return (
    <div className="card">
      <div className="result-head">
        <div>
          <h2>Resultado</h2>
          <div className="msg ok" role="status" style={{ margin: '6px 0 0' }}>
            <p>
              ✓ {Object.keys(data.answers).length} respuestas recibidas
              {data.preset ? ` del preset «${data.preset}»` : ''}
              {lowCount > 0 && ` · ${lowCount} con confianza baja`}
            </p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{(data.latency_ms / 1000).toFixed(1).replace('.', ',')} s</b>
            <span>inferencia (servidor)</span>
          </div>
          <div className="stat">
            <b>{(run.wallMs / 1000).toFixed(1).replace('.', ',')} s</b>
            <span>total (incluye cola{run.attempts > 1 ? ` y ${run.attempts - 1} reintento${run.attempts > 2 ? 's' : ''}` : ''})</span>
          </div>
          <div className="stat">
            <b className="mono">{data.model}</b>
            <span>modelo</span>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'visual' && (
          <div className="answers">
            {Object.entries(data.answers).map(([name, answer]) => (
              <AnswerCard key={name} name={name} answer={answer} def={defs?.[name]} threshold={threshold} />
            ))}
          </div>
        )}
        {tab === 'payload' && <JsonView value={request.body} title={endpoint} />}
        {tab === 'response' && <JsonView value={data} title={<span className="hint">HTTP {response.status} · cuerpo de la respuesta</span>} />}
        {tab === 'curl' && (
          <JsonView
            value={curlFor(request)}
            raw
            title={
              <span className="hint">
                Define antes <code>ARGOS_KEY</code> con tu clave: <code>export ARGOS_KEY=…</code>
              </span>
            }
          />
        )}
      </div>

      <div className="nav">
        <button type="button" className="btn" onClick={onEdit}>
          ← Editar petición
        </button>
        <button type="button" className="btn primary" onClick={onNew}>
          Nueva petición
        </button>
      </div>
    </div>
  )
}
