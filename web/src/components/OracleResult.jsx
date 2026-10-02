import { eightBallView, oracleYesNoView } from '../lib/answerView'
import { KIND_LABELS } from '../lib/oracles'

export function OracleYesNo({ data, question }) {
  const v = oracleYesNoView(data)
  return (
    <div className="oracle oracle-result">
      {question && <p className="oracle-question">«{question}»</p>}
      <div className={`oracle-verdict ${v.answer ? 'yes' : 'no'}`}>{v.label}</div>
      <div className="split" role="img" aria-label={`Sí ${v.yesPct}, No ${v.noPct}`}>
        <div className={`yes ${v.pYes < 0.12 ? 'tiny' : ''}`} style={{ flexBasis: `${v.pYes * 100}%` }}>
          {v.pYes >= 0.12 && `Sí ${v.yesPct}`}
        </div>
        <div className={`no ${1 - v.pYes < 0.12 ? 'tiny' : ''}`} style={{ flexBasis: `${(1 - v.pYes) * 100}%` }}>
          {1 - v.pYes >= 0.12 && `No ${v.noPct}`}
        </div>
      </div>
      <p className="oracle-note">
        P(sí) = <b>{v.yesPct}</b> · confianza <b>{v.confidencePct}</b>
      </p>
    </div>
  )
}

export function Oracle8Ball({ data, question }) {
  const v = eightBallView(data)
  return (
    <div className="oracle oracle-result">
      {question && <p className="oracle-question">«{question}»</p>}
      <div className="ball" role="img" aria-label={`La bola 8 dice: ${v.answer}`}>
        <div className={`ball-window kind-${v.kind}`}>
          <span>{v.answer}</span>
        </div>
      </div>
      <div className="oracle-totals">
        {v.totals.map((t) => (
          <div key={t.kind} className={`oracle-total kind-${t.kind}`}>
            <b>{t.pct}</b>
            <span>{KIND_LABELS[t.kind]}</span>
          </div>
        ))}
      </div>
      <div className="bars oracle-bars">
        {v.rows.map((r) => (
          <div key={r.index} className={`bar-row kind-${r.kind} ${r.winner ? 'winner' : ''}`}>
            <span className="label">
              {r.winner && <span aria-label="ganadora">★ </span>}
              {r.phrase}
            </span>
            <span className="pct">{r.pct}</span>
            <div className="track" title={`${r.phrase}: ${r.pct}`}>
              <div className="fill" style={{ width: `${r.width}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="oracle-note">Barras escaladas a la frase más probable. Los porcentajes suman 100.</p>
    </div>
  )
}
