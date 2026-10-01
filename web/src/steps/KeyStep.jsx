import { useState } from 'react'

export default function KeyStep({ initialKey, initialRemember, checking, error, onVerify }) {
  const [key, setKey] = useState(initialKey ?? '')
  const [remember, setRemember] = useState(initialRemember ?? false)
  const [show, setShow] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (key.trim()) onVerify(key.trim(), remember)
  }

  return (
    <form onSubmit={submit}>
      <div className="step-head">
        <h2>Tu clave de API</h2>
        <p>Argos solo responde a peticiones con una clave válida. Pídesela al administrador si no la tienes.</p>
      </div>
      <label className="field">
        <span>Clave</span>
        <div className="row">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Pega aquí tu clave"
            className={error ? 'invalid' : ''}
            style={{ flex: 1 }}
            autoFocus
          />
          <button type="button" className="btn small" onClick={() => setShow((s) => !s)}>
            {show ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </label>
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Recordar en este navegador
      </label>
      <p className="hint">
        La clave se guarda solo en tu navegador: hasta que cierres la pestaña, o de forma permanente si marcas
        «Recordar». Solo se envía a la API de Argos y nunca aparece en el JSON ni en el curl que se muestran.
      </p>

      {checking && (
        <div className="msg info" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Comprobando clave…</p>
        </div>
      )}
      {error && !checking && (
        <div className="msg error" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="nav">
        <span />
        <button type="submit" className="btn primary" disabled={!key.trim() || checking}>
          Comprobar y continuar →
        </button>
      </div>
    </form>
  )
}
