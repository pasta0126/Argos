export const STEPS = [
  { key: 'key', label: 'Clave' },
  { key: 'mode', label: 'Modo' },
  { key: 'text', label: 'Texto' },
  { key: 'questions', label: 'Preguntas' },
  { key: 'options', label: 'Opciones' },
  { key: 'review', label: 'Enviar' },
]

export default function Stepper({ current, reachable, stepErrors, showErrors, onGo }) {
  return (
    <nav aria-label="Pasos">
      <ol className="stepper">
        {STEPS.map((s, i) => {
          const cls = [
            i === current ? 'current' : i < current ? 'done' : '',
            showErrors(s.key) && stepErrors(s.key) ? 'has-error' : '',
          ].join(' ')
          return (
            <li key={s.key} className={cls}>
              <button
                type="button"
                disabled={!reachable(i)}
                onClick={() => onGo(i)}
                aria-current={i === current ? 'step' : undefined}
              >
                <span className="num">{i < current && !(showErrors(s.key) && stepErrors(s.key)) ? '✓' : i + 1}</span>
                <span className="label">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
