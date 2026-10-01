// The API key lives only in this browser: sessionStorage by default (gone when the tab
// closes), localStorage when the user opts in. Storage can throw (private mode, blocked).
const NAME = 'argos.apiKey'

function get(storage) {
  try {
    return storage.getItem(NAME)
  } catch {
    return null
  }
}

export function loadKey() {
  const remembered = get(localStorage)
  if (remembered) return { key: remembered, remember: true }
  const session = get(sessionStorage)
  return session ? { key: session, remember: false } : null
}

export function saveKey(key, remember) {
  forgetKey()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(NAME, key)
  } catch {
    // Not persisted; the key still works for this page load.
  }
}

export function forgetKey() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(NAME)
    } catch {
      // ignore
    }
  }
}

export const maskKey = (key) => (key.length <= 4 ? '••••' : `••••${key.slice(-4)}`)
