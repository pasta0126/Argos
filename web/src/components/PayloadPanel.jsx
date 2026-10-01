import { PUBLIC_API_URL } from '../lib/config'
import JsonView from './JsonView'

/** Live preview of the request the wizard would send right now. */
export default function PayloadPanel({ request }) {
  return (
    <div className="card">
      <div className="step-head">
        <h2 style={{ fontSize: '1rem' }}>Petición en construcción</h2>
        <p className="hint">Se actualiza con cada cambio: es exactamente lo que se enviará.</p>
      </div>
      <JsonView
        value={request.body}
        title={
          <>
            <span className="method mono">{request.method}</span>
            <code>
              {PUBLIC_API_URL}
              {request.path}
            </code>
          </>
        }
      />
    </div>
  )
}
