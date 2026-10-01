import CopyButton from './CopyButton'

const TOKEN = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function highlight(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const cls = t.startsWith('"') ? (m[2] ? 'k' : 's') : /^[tfn]/.test(t) ? 'l' : 'n'
    out.push(
      <span key={m.index} className={cls}>
        {t}
      </span>,
    )
    last = m.index + t.length
  }
  out.push(text.slice(last))
  return out
}

/** Pretty, highlighted JSON (or raw text) with a copy button. */
export default function JsonView({ value, title, raw = false, extra = null }) {
  const text = raw ? value : JSON.stringify(value, null, 2)
  return (
    <div>
      <div className="code-head">
        <div className="endpoint">{title}</div>
        <div className="row">
          {extra}
          <CopyButton text={text} />
        </div>
      </div>
      <pre className="json" tabIndex={0}>
        {raw ? text : highlight(text)}
      </pre>
    </div>
  )
}
