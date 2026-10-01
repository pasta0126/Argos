import { useState } from 'react'

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without the async clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export default function CopyButton({ text, label = 'Copiar' }) {
  const [state, setState] = useState('idle')
  const onClick = async () => {
    setState((await copy(text)) ? 'done' : 'fail')
    setTimeout(() => setState('idle'), 1800)
  }
  return (
    <button type="button" className="btn small" onClick={onClick} aria-live="polite">
      {state === 'done' ? '✓ Copiado' : state === 'fail' ? 'No se pudo copiar' : label}
    </button>
  )
}
