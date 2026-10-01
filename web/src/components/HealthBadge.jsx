const TEXT = {
  checking: 'Comprobando servicio…',
  loading: 'Cargando modelo…',
  ready: 'Servicio listo',
  down: 'Sin conexión con la API',
}

const TITLE = {
  checking: 'Consultando /health',
  loading: 'El modelo tarda ~1 minuto en cargar tras un reinicio. Se vuelve a comprobar cada 5 s.',
  ready: 'El modelo está cargado y responde.',
  down: 'No se pudo contactar con la API. Se reintenta cada 10 s.',
}

export default function HealthBadge({ health }) {
  return (
    <span className={`chip ${health.status}`} role="status" aria-live="polite" title={TITLE[health.status]}>
      <span className="dot" aria-hidden="true" />
      {TEXT[health.status]}
      {health.status === 'ready' && health.model && <span className="hint">· {health.model}</span>}
    </span>
  )
}
