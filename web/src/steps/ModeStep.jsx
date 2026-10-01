import { EXAMPLES } from '../lib/examples'

export default function ModeStep({ draft, presets, dispatch, onLoaded }) {
  const presetEntries = Object.entries(presets ?? {})
  return (
    <div>
      <div className="step-head">
        <h2>¿Qué quieres preguntar?</h2>
        <p>Usa un preset ya preparado, monta tus propias preguntas o parte de un ejemplo.</p>
      </div>

      <div className="section-title">Presets · preguntas listas para usar</div>
      <div className="choices">
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

      <div className="section-title">Personalizada</div>
      <div className="choices">
        <button
          type="button"
          className="choice-card"
          aria-pressed={draft.mode === 'custom'}
          onClick={() => {
            dispatch({ type: 'chooseCustom' })
            onLoaded('Modo personalizado')
          }}
        >
          <strong>Mis propias preguntas</strong>
          <small>Elige el tipo de cada pregunta (opciones, escala o sí/no) y escribe sus criterios.</small>
          <div className="meta">POST /v1/decide</div>
        </button>
      </div>

      <div className="section-title">Ejemplos · cargan texto y preguntas para editarlos</div>
      <div className="choices">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className="choice-card"
            onClick={() => {
              dispatch({ type: 'loadExample', body: ex.body })
              onLoaded(`Ejemplo «${ex.title}» cargado`)
            }}
          >
            <strong>{ex.title}</strong>
            <small>{ex.body.text.length > 90 ? `${ex.body.text.slice(0, 90)}…` : ex.body.text}</small>
            <div className="meta">{Object.keys(ex.body.questions).length} preguntas</div>
          </button>
        ))}
      </div>
    </div>
  )
}
