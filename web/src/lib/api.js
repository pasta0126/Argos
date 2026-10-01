import { API_URL, PUBLIC_API_URL } from './config'

export const MAX_ATTEMPTS = 6
const DEFAULT_RETRY_S = 5

const abortError = () => new DOMException('cancelada', 'AbortError')

/** Waits `ms`, rejecting with AbortError if `signal` aborts first. */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(abortError())
    }, { once: true })
  })
}

async function readBody(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

/**
 * One HTTP call to the API. Resolves to { ok, status, data, retryAfter } (status 0 = network
 * failure); rejects only with AbortError.
 */
export async function request({ method = 'GET', path, body, key, signal, fetchImpl = fetch }) {
  const headers = {}
  if (key) headers.Authorization = `Bearer ${key}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetchImpl(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    return { ok: false, status: 0, data: null, retryAfter: null }
  }
  const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
  return {
    ok: response.ok,
    status: response.status,
    data: await readBody(response),
    retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
  }
}

/**
 * request() plus automatic retries on 503 (model loading / busy), waiting Retry-After.
 * `onAttempt(attempt)` is called before each call and `onWait({ attempt, maxAttempts, reason,
 * seconds, until })` before each wait. Resolves to the last response with `attempts`.
 */
export async function requestWithRetry(opts, { onAttempt, onWait, maxAttempts = MAX_ATTEMPTS, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    onAttempt?.(attempt)
    const res = await request(opts)
    if (res.status !== 503 || attempt >= maxAttempts) return { ...res, attempts: attempt }
    const seconds = res.retryAfter ?? DEFAULT_RETRY_S
    const reason = res.data?.status === 'loading' ? 'loading' : 'busy'
    onWait?.({ attempt, maxAttempts, reason, seconds, until: Date.now() + seconds * 1000 })
    await wait(seconds * 1000, opts.signal)
  }
}

/** Question name and the rest of the path from a FastAPI 422 `loc`. */
export function locate(loc) {
  if (!Array.isArray(loc)) return { question: null, field: '' }
  const parts = loc[0] === 'body' ? loc.slice(1) : loc
  if (parts[0] === 'questions' && typeof parts[1] === 'string') {
    // Discriminated unions add the type tag to the path: body.questions.x.choice.criteria
    const rest = parts.slice(2).filter((p) => !['choice', 'score', 'yesno'].includes(p))
    return { question: parts[1], field: rest.join('.') }
  }
  return { question: null, field: parts.join('.') }
}

/**
 * Spanish explanation of a failed call: { title, detail, action } where action is
 * 'key' (change the key), 'question' (with `question`), 'retry' or null.
 */
export function explainError(res) {
  const { status, data } = res
  const detail = typeof data?.detail === 'string' ? data.detail : null
  switch (status) {
    case 0:
      return {
        title: 'No se pudo conectar con la API',
        detail: 'Revisa tu conexión. Si persiste, el servicio puede estar caído (mira el indicador de estado arriba).',
        action: 'retry',
      }
    case 401:
      return { title: 'La clave API no es válida', detail: 'Falta la clave o no es correcta. Cámbiala para continuar.', action: 'key' }
    case 404:
      return { title: 'Ese preset no existe', detail: detail ?? 'El preset ya no está publicado. Elige otro.', action: null }
    case 413:
      return { title: 'La petición supera un límite de la API', detail: detail ?? 'Reduce el texto, las preguntas o las opciones.', action: null }
    case 422: {
      const first = Array.isArray(data?.detail) ? data.detail[0] : null
      const { question, field } = locate(first?.loc)
      const where = question ? `Pregunta «${question}»${field ? ` → ${field}` : ''}` : field || 'petición'
      return {
        title: 'La API ha rechazado la petición por formato',
        detail: `${where}: ${first?.msg ?? 'formato no válido'}.`,
        action: question ? 'question' : null,
        question,
      }
    }
    case 503:
      return {
        title: data?.status === 'loading' ? 'El modelo sigue cargando' : 'El servidor sigue ocupado',
        detail: 'Se han agotado los reintentos automáticos. Vuelve a intentarlo en unos segundos.',
        action: 'retry',
      }
    default:
      return { title: `Error inesperado (${status})`, detail: detail ?? 'La API devolvió un error.', action: 'retry' }
  }
}

const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`

/** curl reproducing the request; the key is always the $ARGOS_KEY placeholder. */
export function curlFor({ method, path, body }) {
  const lines = [`curl -s${method === 'GET' ? '' : ` -X ${method}`} ${PUBLIC_API_URL}${path}`, `-H "Authorization: Bearer $ARGOS_KEY"`]
  if (body !== undefined) {
    lines.push(`-H 'Content-Type: application/json'`)
    lines.push(`-d ${shellQuote(JSON.stringify(body, null, 2))}`)
  }
  return lines.join(' \\\n  ')
}
