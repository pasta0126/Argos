import { answerView, formatPct } from '../lib/answerView'

function Bar({ row, threshold }) {
  return (
    <div className={`bar-row ${row.winner ? 'winner' : ''}`}>
      <span className="label">
        {row.winner && <span aria-label="elegida">✓ </span>}
        <span className={row.index === undefined ? 'mono' : ''}>{row.label}</span>
      </span>
      <span className="pct">{row.pct}</span>
      <div className="track" title={`${row.label}: ${row.pct}`}>
        <div className="fill" style={{ width: `${row.p * 100}%` }} />
        {threshold != null && <div className="threshold-line" style={{ left: `${threshold * 100}%` }} title={`umbral ${formatPct(threshold)}`} />}
      </div>
      {row.description && <span className="desc">{row.description}</span>}
    </div>
  )
}

function Choice({ v }) {
  return (
    <>
      <div className="verdict mono">{v.chosen}</div>
      <div className="bars">
        {v.rows.map((r) => (
          <Bar key={r.label} row={r} threshold={v.threshold} />
        ))}
      </div>
    </>
  )
}

function Score({ v }) {
  // Long level names would crowd the scale; the bars above already name them.
  const compactTicks = v.rows.some((r) => r.label.length > 14)
  return (
    <>
      <div className="verdict">
        <span>{v.level}</span> <small>puntuación {v.score.toFixed(2).replace('.', ',')} de {v.max}</small>
      </div>
      <div className="bars">
        {v.rows.map((r) => (
          <Bar key={r.index} row={r} threshold={v.threshold} />
        ))}
      </div>
      <div className="scale" aria-label={`Puntuación ${v.score.toFixed(2)} en una escala de 0 a ${v.max}`}>
        <div className="scale-track">
          <div className="scale-marker" style={{ left: `${v.marker * 100}%` }}>
            <span>{v.score.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
        <div className="scale-ticks">
          {v.rows.map((r) => (
            <span key={r.index} title={r.label}>
              {compactTicks ? r.index : `${r.index} · ${r.label}`}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}

function YesNo({ v }) {
  return (
    <>
      <div className="verdict">
        <span className={v.answer ? 'badge-yes' : 'badge-no'}>{v.answer ? 'Sí' : 'No'}</span>
        <small>P(sí) = {v.yesPct}</small>
      </div>
      <div className="split" role="img" aria-label={`Sí ${v.yesPct}, No ${v.noPct}`}>
        <div className={`yes ${v.pYes < 0.12 ? 'tiny' : ''}`} style={{ flexBasis: `${v.pYes * 100}%` }}>
          {v.pYes >= 0.12 && `Sí ${v.yesPct}`}
        </div>
        <div className={`no ${1 - v.pYes < 0.12 ? 'tiny' : ''}`} style={{ flexBasis: `${(1 - v.pYes) * 100}%` }}>
          {1 - v.pYes >= 0.12 && `No ${v.noPct}`}
        </div>
      </div>
      <div className="split-legend">
        <span>{v.yesText ? `Sí: ${v.yesText}` : `Sí ${v.yesPct}`}</span>
        <span style={{ textAlign: 'right' }}>{v.noText ? `No: ${v.noText}` : `No ${v.noPct}`}</span>
      </div>
    </>
  )
}

export default function AnswerCard({ name, answer, def, threshold }) {
  const v = answerView(answer, def, threshold)
  return (
    <article className={`answer ${v.low ? 'low' : ''}`}>
      <div className="answer-head">
        <div>
          <h3 className="mono">{name}</h3>
          {v.instructions && <p>{v.instructions}</p>}
        </div>
        {v.low && (
          <span className="low-chip" title={`La confianza está por debajo del umbral ${formatPct(threshold ?? 0)}`}>
            ⚠ Confianza baja
          </span>
        )}
      </div>
      {v.kind === 'choice' && <Choice v={v} />}
      {v.kind === 'score' && <Score v={v} />}
      {v.kind === 'yesno' && <YesNo v={v} />}
      <div className="confidence">
        <span>Confianza</span>
        <div className="track">
          <div className="fill" style={{ width: `${v.confidence * 100}%` }} />
          {threshold != null && <div className="threshold-line" style={{ left: `${threshold * 100}%` }} />}
        </div>
        <b>{formatPct(v.confidence)}</b>
      </div>
    </article>
  )
}
