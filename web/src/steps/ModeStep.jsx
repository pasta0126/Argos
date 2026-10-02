import { ORACLES } from '../lib/oracles'

export default function ModeStep({ draft, presets, dispatch, onLoaded }) {
  const presetEntries = Object.entries(presets ?? {})
  return (
    <div>
      <div className="step-head">
        <h2>¿Qué quieres preguntar?</h2>
        <p>Monta tus propias preguntas o usa uno de los presets ya preparados.</p>
      </div>

      <div className="choices grid-3">
        <button
          type="button"
          className="choice-card favorite"
          aria-pressed={draft.mode === 'custom'}
          onClick={() => {
            dispatch({ type: 'chooseCustom' })
            onLoaded('Modo personalizado')
          }}
        >
          <strong>
            <span className="star" aria-label="Favorito">
              ★
            </span>{' '}
            Personalizado
          </strong>
          <small>Tus propias preguntas: elige el tipo de cada una (opciones, escala o sí/no) y escribe sus criterios.</small>
          <div className="meta">POST /v1/decide</div>
        </button>
        {presetEntries.map(([name, p]) => (
          <button
            key={name}
            type="button"
            className="choice-card"
            aria-pressed={draft.mode === 'preset' && draft.presetName === name}
            onClick={() => {
              dispatch({ type: 'choosePreset', name, questions: Object.keys(p.questions) })
              onLoaded(`Preset «${name}» seleccionado`)
            }}
          >
            <strong>{name}</strong>
            <small>{p.description}</small>
            <div className="meta">{Object.keys(p.questions).length} preguntas · POST /v1/presets/{name}</div>
          </button>
        ))}
      </div>

      <section className="oracle oracle-group" aria-labelledby="oracle-title">
        <h3 id="oracle-title">
          <span aria-hidden="true">✦</span> Oráculo
        </h3>
        <p>Solo escribes una pregunta: la instrucción es fija y el oráculo siempre responde.</p>
        <div className="choices grid-2">
          {Object.entries(ORACLES).map(([name, o]) => (
            <button
              key={name}
              type="button"
              className="choice-card oracle-card"
              aria-pressed={draft.mode === 'oracle' && draft.oracleName === name}
              onClick={() => {
                dispatch({ type: 'chooseOracle', name })
                onLoaded(`${o.title} seleccionado`)
              }}
            >
              <strong>
                <span aria-hidden="true">{name === '8ball' ? '➑' : '☯'}</span> {o.title}
              </strong>
              <small>{o.description}</small>
              <div className="meta">POST /v1/oracle/{name}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
