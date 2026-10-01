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
    </div>
  )
}
